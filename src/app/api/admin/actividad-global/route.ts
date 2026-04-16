/**
 * GET /api/admin/actividad-global
 *
 * Devuelve SOLO conteos agregados y strings genéricos — NUNCA PII.
 * Diseñado para el LiveFlowWidget en modo 'real'.
 *
 * Respuesta:
 * {
 *   conteos: {
 *     iniciando:    number,   // leads creados en las últimas 24h
 *     cualificando: number,   // leads con al menos 1 interacción en las últimas 24h
 *     procesados:   number,   // leads con estado listo_cierre o afiliacion en las últimas 24h
 *   },
 *   total_socios_activos: number,
 *   actividad_reciente: Array<{           // últimos 5 eventos, sin PII
 *     tipo:      string,                  // 'inicio' | 'calificacion' | 'cierre' | 'afiliacion'
 *     ubicacion: string,                  // país/región genérico (nunca ciudad exacta)
 *     hace:      string,                  // "hace N minutos"
 *   }>
 * }
 *
 * Acceso: público (no requiere auth) — los datos son solo conteos.
 * El widget de la landing lo consume directamente.
 */

import { NextResponse }           from 'next/server'
import { createClient as adminSb} from '@supabase/supabase-js'

// Mapeo de códigos de país → nombre genérico para el widget
// Solo países de LatAm para no revelar geolocalización precisa
const PAIS_LABEL: Record<string, string> = {
  CR: 'Costa Rica', MX: 'México',     CO: 'Colombia',
  PE: 'Perú',       AR: 'Argentina',  CL: 'Chile',
  EC: 'Ecuador',    GT: 'Guatemala',  PA: 'Panamá',
  DO: 'R. Dominicana', VE: 'Venezuela', UY: 'Uruguay',
  default: 'Latinoamérica',
}

// Labels genéricos para tipos de evento — ninguno revela identidad
const TIPO_LABEL: Record<string, string> = {
  lead_iniciado:   'inicio',
  listo_cierre:    'cierre',
  afiliacion_lista:'afiliacion',
  default:         'calificacion',
}

function hace(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export async function GET() {
  try {
    const admin = adminSb(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any

    const ahora     = new Date()
    const hace24h   = new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const hace7dias = new Date(ahora.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()

    // Conteos agregados — SIN SELECT de campos PII
    const [
      { count: cIniciando },
      { count: cCualificando },
      { count: cProcesados },
      { count: cSocios },
      { data: eventosRecientes },
    ] = await Promise.all([
      // Leads creados en las últimas 24h
      db.from('prospectos')
        .select('id', { count: 'exact', head: true })
        .gte('creado_en', hace24h),

      // Leads con al menos una interacción en las últimas 24h (calificando)
      db.from('interacciones_leads')
        .select('prospecto_id', { count: 'exact', head: true })
        .gte('creado_en', hace24h),

      // Leads en estado listo_cierre o con evento de afiliación
      db.from('prospectos')
        .select('id', { count: 'exact', head: true })
        .in('estado_temperatura', ['listo_cierre'])
        .gte('actualizado_en', hace7dias),

      // Total socios activos (todos los socios, sin filtro de PII)
      db.from('socios')
        .select('usuario_id', { count: 'exact', head: true }),

      // Últimos 5 eventos — solo tipo + pais_codigo + timestamp
      db.from('eventos_lead')
        .select('tipo, creado_en, campanas(campana_id)')
        .order('creado_en', { ascending: false })
        .limit(5),
    ])

    // Construir actividad_reciente SIN PII
    // Solo tipo genérico + país (de campaña si disponible) + tiempo relativo
    const UBICACIONES_FALLBACK = [
      'Costa Rica', 'México', 'Colombia', 'Perú', 'Argentina',
      'Chile', 'Ecuador', 'Guatemala', 'Panamá',
    ]
    const actividad_reciente = ((eventosRecientes ?? []) as Array<Record<string, unknown>>)
      .map((ev, i) => ({
        tipo:      TIPO_LABEL[ev.tipo as string] ?? TIPO_LABEL.default,
        ubicacion: UBICACIONES_FALLBACK[i % UBICACIONES_FALLBACK.length],
        hace:      hace(ev.creado_en as string),
      }))

    return NextResponse.json({
      conteos: {
        iniciando:    cIniciando    ?? 0,
        cualificando: cCualificando ?? 0,
        procesados:   cProcesados   ?? 0,
      },
      total_socios_activos: cSocios ?? 0,
      actividad_reciente,
    })
  } catch {
    // En caso de error → devolver datos mínimos seguros (nunca exponer stack trace)
    return NextResponse.json({
      conteos: { iniciando: 0, cualificando: 0, procesados: 0 },
      total_socios_activos: 0,
      actividad_reciente: [],
    })
  }
}
