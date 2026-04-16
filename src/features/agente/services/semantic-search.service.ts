/**
 * semantic-search.service.ts
 *
 * Búsqueda semántica con pgvector.
 * Enriquece el contexto del agente con fragmentos de KBs e ingredientes
 * relevantes a lo que el usuario está preguntando.
 *
 * Requiere: pgvector habilitado + migración 20260412_pgvector_embeddings.sql
 */

import { embed }                   from 'ai'
import { aiProvider, MODELS }      from '@/lib/ai-provider'
import { createClient }            from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Tipos de retorno de los RPCs ────────────────────────────────────────────

interface KBMatch {
  kb_id:                string
  condicion:            string
  tipo_kb:              string
  sintomas_json:        unknown
  preguntas_json:       unknown
  objeciones_json:      unknown
  protocolo_derivacion: string | null
  similarity:           number
}

interface IngredienteMatch {
  ingrediente_id:  string
  nombre:          string
  descripcion:     string | null
  usos_json:       unknown
  nivel_evidencia: string | null
  puede_citar:     boolean
  similarity:      number
}

// ─── Generar embedding ────────────────────────────────────────────────────────

async function generarEmbedding(texto: string): Promise<number[]> {
  const { embedding } = await embed({
    model: aiProvider.embedding(MODELS.embedding),
    value: texto,
  })
  return embedding
}

// ─── Texto de consulta desde mensajes del usuario ────────────────────────────

export function buildQueryFromMessages(
  messages: Array<{ role: string; content: string }>,
  maxChars = 800,
): string {
  return messages
    .filter(m => m.role === 'user')
    .slice(-4)                          // solo las últimas 4 respuestas
    .map(m => m.content)
    .join(' ')
    .slice(0, maxChars)
}

// ─── Buscar KBs relevantes ────────────────────────────────────────────────────

async function buscarKBsRelevantes(
  embedding: number[],
  tenant_id: string,
  excludeKbId?: string,
): Promise<KBMatch[]> {
  const { data, error } = await supabaseAdmin.rpc('match_knowledge_base', {
    query_embedding:  embedding,
    match_threshold:  0.5,
    match_count:      2,
    p_tenant_id:      tenant_id,
  })

  if (error || !data) return []

  return (data as KBMatch[]).filter(r => r.kb_id !== excludeKbId)
}

// ─── Buscar ingredientes relevantes ──────────────────────────────────────────

async function buscarIngredientesRelevantes(
  embedding: number[],
  tenant_id: string,
): Promise<IngredienteMatch[]> {
  const { data, error } = await supabaseAdmin.rpc('match_ingredientes', {
    query_embedding:  embedding,
    match_threshold:  0.5,
    match_count:      4,
    p_tenant_id:      tenant_id,
  })

  if (error || !data) return []
  return data as IngredienteMatch[]
}

// ─── Formatear KBs para el system prompt ─────────────────────────────────────

function formatKBContexto(kbs: KBMatch[]): string {
  if (!kbs.length) return ''
  return kbs.map(kb => {
    const partes: string[] = [`[KB: ${kb.condicion} — similitud ${(kb.similarity * 100).toFixed(0)}%]`]
    if (kb.sintomas_json)        partes.push(`Síntomas: ${JSON.stringify(kb.sintomas_json)}`)
    if (kb.objeciones_json)      partes.push(`Objeciones: ${JSON.stringify(kb.objeciones_json)}`)
    if (kb.protocolo_derivacion) partes.push(`Protocolo: ${kb.protocolo_derivacion}`)
    return partes.join('\n')
  }).join('\n\n')
}

// ─── Formatear ingredientes para el system prompt ────────────────────────────

function formatIngredientesContexto(ingredientes: IngredienteMatch[]): string {
  if (!ingredientes.length) return ''
  const citables = ingredientes.filter(i => i.puede_citar)
  if (!citables.length) return ''
  return citables.map(i => {
    const usos = i.usos_json ? ` | Usos: ${JSON.stringify(i.usos_json)}` : ''
    const ev   = i.nivel_evidencia ? ` (evidencia: ${i.nivel_evidencia})` : ''
    return `- ${i.nombre}${ev}${usos}`
  }).join('\n')
}

// ─── Función principal exportada ─────────────────────────────────────────────

export interface ContextoSemantico {
  kbContexto:            string   // fragmentos adicionales de KBs relacionadas
  ingredientesContexto:  string   // ingredientes citables relevantes
  tieneContexto:         boolean
}

export async function buscarContextoRelevante(params: {
  query:        string
  tenant_id:    string
  kb_id_actual?: string          // excluir la KB principal ya cargada
}): Promise<ContextoSemantico> {
  if (!params.query.trim()) {
    return { kbContexto: '', ingredientesContexto: '', tieneContexto: false }
  }

  try {
    const embedding = await generarEmbedding(params.query)

    const [kbs, ingredientes] = await Promise.all([
      buscarKBsRelevantes(embedding, params.tenant_id, params.kb_id_actual),
      buscarIngredientesRelevantes(embedding, params.tenant_id),
    ])

    const kbContexto           = formatKBContexto(kbs)
    const ingredientesContexto = formatIngredientesContexto(ingredientes)

    return {
      kbContexto,
      ingredientesContexto,
      tieneContexto: !!(kbContexto || ingredientesContexto),
    }
  } catch {
    // Fallo silencioso: el agente sigue funcionando sin contexto semántico
    return { kbContexto: '', ingredientesContexto: '', tieneContexto: false }
  }
}

// ─── Guardar embedding de un KB (llamado desde admin al crear/editar KB) ──────

export async function guardarEmbeddingKB(kb_id: string): Promise<void> {
  const { data: kb } = await supabaseAdmin
    .from('knowledge_bases')
    .select('kb_id, condicion, sintomas_json, protocolo_derivacion, embedding_texto')
    .eq('kb_id', kb_id)
    .single()

  if (!kb) return

  const texto = kb.embedding_texto ?? (
    `Condición: ${kb.condicion ?? ''}\n` +
    `Síntomas: ${JSON.stringify(kb.sintomas_json) ?? ''}\n` +
    `Protocolo: ${kb.protocolo_derivacion ?? ''}`
  )

  const embedding = await generarEmbedding(texto)

  await supabaseAdmin
    .from('knowledge_bases')
    .update({ embedding: JSON.stringify(embedding) as unknown as never })
    .eq('kb_id', kb_id)
}

// ─── Guardar embedding de un ingrediente ─────────────────────────────────────

export async function guardarEmbeddingIngrediente(ingrediente_id: string): Promise<void> {
  const { data: ing } = await supabaseAdmin
    .from('ingredientes')
    .select('ingrediente_id, nombre, descripcion, usos_json, embedding_texto')
    .eq('ingrediente_id', ingrediente_id)
    .single()

  if (!ing) return

  const texto = ing.embedding_texto ?? (
    `Ingrediente: ${ing.nombre ?? ''}\n` +
    `Descripción: ${ing.descripcion ?? ''}\n` +
    `Usos: ${JSON.stringify(ing.usos_json) ?? ''}`
  )

  const embedding = await generarEmbedding(texto)

  await supabaseAdmin
    .from('ingredientes')
    .update({ embedding: JSON.stringify(embedding) as unknown as never })
    .eq('ingrediente_id', ingrediente_id)
}
