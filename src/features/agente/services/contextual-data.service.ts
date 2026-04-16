import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ContextualData } from '../types/agente.types'

// Cliente admin — bypassa RLS para lectura de contexto del agente (endpoint público)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Carga todo el contexto que el agente IA necesita para una campaña específica.
 *
 * JOIN real:
 *   campanas
 *     → paises            (pais_id)
 *     → condiciones_salud (condicion_salud_id)
 *     → knowledge_bases   (knowledge_base_id)
 *     → socios            (socio_id)
 *       → socio_assets    (usuario_id = socio_id)
 *     → condicion_productos_por_pais (condicion_id + pais_id)
 *       → productos       (producto_id)
 */
export async function getContextualData(campana_id: string): Promise<ContextualData> {
  // ─── 1. Campaña + relaciones principales ─────────────────────────────────
  const { data: campana, error } = await supabaseAdmin
    .from('campanas')
    .select(`
      campana_id,
      tenant_id,
      pais_id,
      nombre,
      tipo,
      agente_tipo,
      requiere_cita,
      condicion_salud_id,
      socio_id,
      knowledge_base_id,
      paises (
        nombre,
        codigo
      ),
      condiciones_salud (
        nombre,
        descripcion
      ),
      knowledge_bases (
        condicion,
        tipo_kb,
        sintomas_json,
        preguntas_json,
        objeciones_json,
        lenguaje_prohibido_json,
        protocolo_derivacion
      ),
      socios (
        usuario_id,
        nombre_completo,
        foto_url,
        avatar_url,
        voz_url
      )
    `)
    .eq('campana_id', campana_id)
    .eq('estado', 'activa')
    .single()

  if (error || !campana) {
    throw new Error(`Campaña no encontrada o inactiva: ${campana_id}`)
  }

  const pais   = campana.paises          as { nombre: string; codigo: string } | null
  const cond   = campana.condiciones_salud as { nombre: string; descripcion: string | null } | null
  const kb     = campana.knowledge_bases  as ContextualData['knowledge_base']
  const socio  = campana.socios           as {
    usuario_id: string
    nombre_completo: string
    foto_url: string | null
    avatar_url: string | null
    voz_url: string | null
  } | null

  if (!pais) throw new Error(`País no encontrado para campaña: ${campana_id}`)

  // ─── 2. Assets del socio ──────────────────────────────────────────────────
  let assets: NonNullable<ContextualData['socio']>['assets'] = []
  if (socio?.usuario_id) {
    const { data: rawAssets } = await supabaseAdmin
      .from('socio_assets')
      .select('tipo, url, alt_text, orden')
      .eq('socio_id', socio.usuario_id)
      .eq('activo', true)
      .order('orden', { ascending: true })

    assets = rawAssets ?? []
  }

  // ─── 3. Productos recomendados para esta condición × país ────────────────
  let productos: ContextualData['productos'] = []
  if (campana.condicion_salud_id) {
    const { data: rawProductos } = await supabaseAdmin
      .from('condicion_productos_por_pais')
      .select(`
        prioridad,
        lenguaje_agente,
        razon_recomendacion,
        productos ( nombre )
      `)
      .eq('condicion_id', campana.condicion_salud_id)
      .eq('pais_id', campana.pais_id)
      .eq('activo', true)
      .order('prioridad', { ascending: true })

    productos = (rawProductos ?? []).map((p) => ({
      nombre:               (p.productos as { nombre: string } | null)?.nombre ?? 'Producto',
      prioridad:            p.prioridad,
      lenguaje_agente:      p.lenguaje_agente,
      razon_recomendacion:  p.razon_recomendacion ?? null,
    }))
  }

  // ─── 4. Ensamblar resultado ───────────────────────────────────────────────
  return {
    campana: {
      campana_id:    campana.campana_id,
      tenant_id:     campana.tenant_id,
      pais_id:       campana.pais_id,
      nombre:        campana.nombre,
      tipo:          campana.tipo,
      agente_tipo:   campana.agente_tipo,
      requiere_cita: campana.requiere_cita,
      pais:          pais,
      condicion:     cond,
    },
    socio: socio
      ? { ...socio, assets }
      : null,
    knowledge_base: kb ?? null,
    productos,
  }
}
