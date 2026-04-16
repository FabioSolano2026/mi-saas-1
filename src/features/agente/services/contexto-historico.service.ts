/**
 * Servicio de Ingesta de Contexto Histórico
 *
 * Cuando un socio carga historial previo de un lead, este servicio:
 *  1. Guarda el texto original como interacción tipo 'contexto_inicial' (es_historia=true)
 *  2. Llama al LLM para generar un Resumen Ejecutivo compacto
 *  3. Guarda el resumen como interacción tipo 'texto' (es_historia=true, es_resumen=true)
 *
 * El agente lee el resumen en cada inicio de conversación para evitar repeticiones.
 */

import { generateText }                  from 'ai'
import { chatModel }                     from '@/lib/ai-provider'
import { createClient }         from '@supabase/supabase-js'

interface IngestaContextoParams {
  prospecto_id:      string
  campana_id:        string | null
  tenant_id:         string
  historial_contexto: string
  audio_url?:        string   // URL a audios_leads bucket (ya subido)
}

interface ResultadoIngesta {
  interaccion_id: string
  resumen_id:     string
  resumen:        string
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function ingestarContextoHistorico(
  params: IngestaContextoParams,
): Promise<ResultadoIngesta> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // 1. Guardar contexto original
  const { data: interaccion, error: err1 } = await db
    .from('interacciones_leads')
    .insert({
      prospecto_id: params.prospecto_id,
      campana_id:   params.campana_id,
      tenant_id:    params.tenant_id,
      tipo:         'contexto_inicial',
      contenido:    params.historial_contexto,
      emisor:       'socio',
      es_historia:  true,
      es_resumen:   false,
    })
    .select('id')
    .single()

  if (err1) throw new Error(`Error guardando contexto: ${err1.message}`)

  // Si hay audio, guardarlo en interacciones_privado
  if (params.audio_url) {
    await db.from('interacciones_privado').insert({
      interaccion_id: (interaccion as { id: string }).id,
      audio_url:      params.audio_url,
      transcripcion:  params.historial_contexto, // el texto sirve como transcripción
    })
  }

  // 2. Generar Resumen Ejecutivo con LLM
  const resumen = await _generarResumenEjecutivo(params.historial_contexto)

  // 3. Guardar resumen (lo lee el agente en cada conversación)
  const { data: resumenInteraccion, error: err2 } = await db
    .from('interacciones_leads')
    .insert({
      prospecto_id: params.prospecto_id,
      campana_id:   params.campana_id,
      tenant_id:    params.tenant_id,
      tipo:         'texto',
      contenido:    resumen,
      emisor:       'agente',
      es_historia:  true,
      es_resumen:   true,
    })
    .select('id')
    .single()

  if (err2) throw new Error(`Error guardando resumen: ${err2.message}`)

  return {
    interaccion_id: (interaccion as { id: string }).id,
    resumen_id:     (resumenInteraccion as { id: string }).id,
    resumen,
  }
}

// ─── Ingesta en lote: mismo contexto para N prospectos ────────────────────────

export async function ingestarContextoLote(params: {
  prospecto_ids:      string[]
  campana_id:         string | null
  tenant_id:          string
  historial_contexto: string
  audio_url?:         string
}): Promise<{ procesados: number; resumen: string }> {
  // Generar UN solo resumen para todo el lote (eficiencia)
  const resumen = await _generarResumenEjecutivo(params.historial_contexto)

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Insertar contexto original + resumen para cada prospecto en un solo INSERT en lote
  const filasContexto = params.prospecto_ids.map((pid) => ({
    prospecto_id: pid,
    campana_id:   params.campana_id,
    tenant_id:    params.tenant_id,
    tipo:         'contexto_inicial',
    contenido:    params.historial_contexto,
    emisor:       'socio',
    es_historia:  true,
    es_resumen:   false,
  }))

  const filasResumen = params.prospecto_ids.map((pid) => ({
    prospecto_id: pid,
    campana_id:   params.campana_id,
    tenant_id:    params.tenant_id,
    tipo:         'texto',
    contenido:    resumen,
    emisor:       'agente',
    es_historia:  true,
    es_resumen:   true,
  }))

  await db.from('interacciones_leads').insert([...filasContexto, ...filasResumen])

  return { procesados: params.prospecto_ids.length, resumen }
}

// ─── Contexto completo para el agente ────────────────────────────────────────

export interface ContextoAgente {
  resumen:           string
  resumen_id:        string   // id de la fila en interacciones_leads
  resumen_validado:  boolean  // true = luz verde; false = proceder con cautela
}

/**
 * Lee el último resumen ejecutivo del lead y el flag resumen_validado del prospecto.
 * Devuelve null si no hay historial previo.
 */
export async function leerContextoAgente(
  prospecto_id: string,
): Promise<ContextoAgente | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Leer resumen + flag en paralelo
  const [{ data: resumenRow }, { data: prospecto }] = await Promise.all([
    db
      .from('interacciones_leads')
      .select('id, contenido')
      .eq('prospecto_id', prospecto_id)
      .eq('es_historia', true)
      .eq('es_resumen', true)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single(),
    db
      .from('prospectos')
      .select('resumen_validado')
      .eq('prospecto_id', prospecto_id)
      .single(),
  ])

  if (!resumenRow?.contenido) return null

  return {
    resumen:          resumenRow.contenido as string,
    resumen_id:       resumenRow.id        as string,
    resumen_validado: (prospecto as { resumen_validado: boolean } | null)?.resumen_validado ?? false,
  }
}

/** Mantener compatibilidad con llamadas anteriores */
export async function leerResumenEjecutivo(
  prospecto_id: string,
): Promise<string | null> {
  const ctx = await leerContextoAgente(prospecto_id)
  return ctx?.resumen ?? null
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

async function _generarResumenEjecutivo(historial: string): Promise<string> {
  try {
    const { text } = await generateText({
      model:  chatModel,
      system: `Eres un asistente que genera resúmenes ejecutivos compactos para agentes de ventas.
Tu misión: dado un historial de conversación o notas sobre un lead, extraer:
- Interés principal del lead (qué le preocupa, qué busca)
- Objeciones o resistencias mencionadas
- Datos clave (situación de salud, familia, presupuesto si aplica)
- Estado emocional / nivel de confianza
- Lo que ya sabe sobre el producto/servicio
- Próximo paso sugerido

Formato: texto corrido de máximo 5 oraciones, directo y accionable para el agente.
Nunca inventes datos que no estén en el historial.`,
      prompt: `Historial del lead:\n\n${historial.slice(0, 8000)}`,
      maxOutputTokens: 300,
      temperature:     0.2,
    })
    return text
  } catch {
    // Si falla la IA, guardar resumen mínimo para no bloquear el flujo
    return `[Contexto cargado manualmente — revisar historial original para detalles]`
  }
}
