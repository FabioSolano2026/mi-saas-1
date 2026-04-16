/**
 * Motor de Identidad — Identity Engine
 *
 * Carga los assets de identidad del socio (voz, avatar, estilo)
 * y decide qué personalidad proyecta el agente según la fase del lead.
 *
 * Fases de identidad:
 *  - calificacion  → agente neutro (nombre del socio, tono genérico)
 *  - cierre        → agente usa assets del socio (foto, voz clonada si hay)
 *  - afiliacion    → agente se convierte en "asistente personal de [Socio]"
 */

import { createClient } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FaseIdentidad = 'calificacion' | 'cierre' | 'afiliacion'
export type EstiloComunicacion = 'profesional' | 'amigable' | 'motivacional' | 'cercano'
export type TipoCierre = 'automatico' | 'callcenter'

export interface IdentidadSocio {
  // Datos básicos
  nombre:           string
  foto_url:         string | null
  avatar_url:       string | null
  voz_url:          string | null
  id_afiliado:      string

  // Motor de identidad
  voz_clonada_id:   string | null
  voz_proveedor:    string
  voz_aprobada:     boolean          // admin must approve before use
  avatar_aprobado:  boolean
  estilo_comunicacion: EstiloComunicacion
  tipo_cierre:      TipoCierre

  // Flujo de afiliación
  callcenter_url:   string | null
  callcenter_telefono: string | null
  portal_registro_url: string | null
  mensaje_cierre_custom: string | null
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function cargarIdentidadSocio(socio_id: string): Promise<IdentidadSocio | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Socios + perfiles_socio en un solo JOIN
  const { data, error } = await db
    .from('socios')
    .select(`
      nombre_completo, foto_url, avatar_url, voz_url, id_afiliado,
      perfiles_socio (
        voz_clonada_id, voz_proveedor,
        voz_aprobada, avatar_aprobado,
        estilo_comunicacion, tipo_cierre,
        callcenter_url, callcenter_telefono,
        portal_registro_url, mensaje_cierre_custom
      )
    `)
    .eq('usuario_id', socio_id)
    .single()

  if (error || !data) return null

  const s = data as Record<string, unknown>
  const p = (Array.isArray(s.perfiles_socio)
    ? (s.perfiles_socio[0] ?? {})
    : (s.perfiles_socio ?? {})) as Record<string, unknown>

  return {
    nombre:             (s.nombre_completo as string) ?? 'el especialista',
    foto_url:           (s.foto_url        as string | null) ?? null,
    avatar_url:         (s.avatar_url      as string | null) ?? null,
    voz_url:            (s.voz_url         as string | null) ?? null,
    id_afiliado:        (s.id_afiliado     as string) ?? socio_id.slice(0, 8).toUpperCase(),

    voz_clonada_id:      (p.voz_clonada_id     as string | null) ?? null,
    voz_proveedor:       (p.voz_proveedor      as string)        ?? 'elevenlabs',
    voz_aprobada:        (p.voz_aprobada       as boolean)       ?? false,
    avatar_aprobado:     (p.avatar_aprobado    as boolean)       ?? false,
    estilo_comunicacion: (p.estilo_comunicacion as EstiloComunicacion) ?? 'profesional',
    tipo_cierre:         (p.tipo_cierre         as TipoCierre)   ?? 'callcenter',

    callcenter_url:       (p.callcenter_url       as string | null) ?? null,
    callcenter_telefono:  (p.callcenter_telefono  as string | null) ?? null,
    portal_registro_url:  (p.portal_registro_url  as string | null) ?? null,
    mensaje_cierre_custom:(p.mensaje_cierre_custom as string | null) ?? null,
  }
}

// ─── Construir instrucciones de identidad para el system prompt ───────────────

export function buildIdentityInstructions(
  identidad: IdentidadSocio,
  fase:      FaseIdentidad,
): string {
  const tono = TONOS[identidad.estilo_comunicacion]

  if (fase === 'calificacion') {
    return `Representas a ${identidad.nombre}. Tono: ${tono}.`
  }

  if (fase === 'cierre') {
    const assetsFoto = identidad.foto_url
      ? `\nEl lead puede ver la foto de ${identidad.nombre} en la landing.`
      : ''
    const notaVoz = identidad.voz_clonada_id && !identidad.voz_aprobada
      ? `\n(Nota interna: voz clonada pendiente de aprobación — usar TTS genérico con este tono.)`
      : ''
    return `Ahora representas DIRECTAMENTE a ${identidad.nombre} con su identidad completa.${assetsFoto}${notaVoz}
Tono: ${tono}. Genera máxima confianza personal, como si fuera el propio ${identidad.nombre} escribiendo.
Usa frases en primera persona: "Yo personally te ayudo", "En mi experiencia…".`
  }

  // fase === 'afiliacion'
  return `Eres el asistente personal de ${identidad.nombre} y estás guiando al lead a través del proceso de registro.
Representa a ${identidad.nombre} con total confianza y entusiasmo.
Tono: ${tono}. Este es el momento más importante — cierra con calidez y claridad.`
}

const TONOS: Record<EstiloComunicacion, string> = {
  profesional:  'serio, preciso, confiable',
  amigable:     'cálido, cercano, conversacional',
  motivacional: 'energético, inspirador, orientado a resultados',
  cercano:      'como amigo de confianza, personal, empático',
}
