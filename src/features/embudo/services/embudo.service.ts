/**
 * Embudo de Fuerza — Servicio Central
 *
 * Gestiona el ciclo de vida del lead desde la captura hasta el cierre.
 * El control es 100% de la plataforma hasta que se activa listo_cierre.
 *
 *  Eventos del embudo:
 *  lead_iniciado       → lead creado, se agenda notificación de captura
 *  notificacion_enviada → mensaje WhatsApp/email enviado al lead
 *  listo_cierre        → agente detectó señal de cierre, alerta al socio
 *  cierre_completado   → socio confirmó el cierre
 */

import { createClient } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoEvento = 'lead_iniciado' | 'notificacion_enviada' | 'listo_cierre' | 'cierre_completado'
export type CanalNotificacion = 'whatsapp' | 'email'

export interface DatosLead {
  prospecto_id: string
  tenant_id:    string
  campana_id:   string | null
  nombre:       string
  telefono:     string | null
  correo:       string | null
  socio_id:     string
}

export interface AlertaCierre {
  prospecto_id:   string
  nombre:         string
  telefono:       string | null
  correo:         string | null
  resumen_agente: string | null
  link_chat:      string          // URL de la landing con link de afiliado
  campana_id:     string | null
  creado_en:      string
}

// ─── Helper: cliente admin ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── 1. Evento lead_iniciado ──────────────────────────────────────────────────

/**
 * Disparar cuando se crea un lead. Registra el evento y encola
 * la notificación de captura (invitación a la landing de campaña).
 */
export async function dispararLeadIniciado(lead: DatosLead): Promise<void> {
  const admin = db()

  // Guardar evento
  await admin.from('eventos_lead').insert({
    prospecto_id: lead.prospecto_id,
    tenant_id:    lead.tenant_id,
    tipo:         'lead_iniciado',
    payload:      { campana_id: lead.campana_id, origen: 'volcado_manual' },
  })

  // Generar y encolar notificaciones de captura
  const mensajes = await _buildMensajesCaptura(lead)
  if (mensajes.length > 0) {
    await admin.from('notificaciones_leads').insert(mensajes)
  }
}

/**
 * Disparar en lote (bulk import). Un evento por prospecto, eficiente.
 */
export async function dispararLeadIniciadoLote(
  leads: DatosLead[],
): Promise<void> {
  if (!leads.length) return
  const admin = db()

  const eventos = leads.map((l) => ({
    prospecto_id: l.prospecto_id,
    tenant_id:    l.tenant_id,
    tipo:         'lead_iniciado',
    payload:      { campana_id: l.campana_id, origen: 'volcado_manual' },
  }))

  const notificaciones = (
    await Promise.all(leads.map(_buildMensajesCaptura))
  ).flat()

  await Promise.all([
    admin.from('eventos_lead').insert(eventos),
    notificaciones.length > 0
      ? admin.from('notificaciones_leads').insert(notificaciones)
      : Promise.resolve(),
  ])
}

// ─── 2. Switch de Cierre ──────────────────────────────────────────────────────

/**
 * Activa el cierre de un lead:
 *  1. Cambia estado_temperatura → 'listo_cierre'
 *  2. Mueve al kanban a 'propuesta_enviada'  (columna "Contactar para Compra")
 *  3. Registra evento listo_cierre
 *  4. Encola alerta para el socio con resumen + link de chat
 */
export async function activarSwitchCierre(
  prospecto_id: string,
  resumen_agente: string | null,
): Promise<AlertaCierre | null> {
  const admin = db()

  // Obtener datos completos del prospecto
  const { data: prospecto, error } = await admin
    .from('prospectos')
    .select(`
      prospecto_id, nombre, telefono, correo,
      tenant_id, socio_id, campana_id,
      columna_kanban, estado_temperatura, creado_en
    `)
    .eq('prospecto_id', prospecto_id)
    .single()

  if (error || !prospecto) return null

  const p = prospecto as Record<string, unknown>

  // Idempotente: ya está en cierre
  if (p.estado_temperatura === 'listo_cierre') {
    return _buildAlertaCierre(p, resumen_agente)
  }

  // Obtener link de afiliado del socio
  const { data: link } = await admin
    .from('links_afiliados')
    .select('id_corto')
    .eq('socio_id', p.socio_id)
    .eq('campana_id', p.campana_id)
    .limit(1)
    .single()

  const idCorto    = (link as { id_corto: string } | null)?.id_corto ?? null
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const linkChat   = idCorto ? `${siteUrl}/c/${idCorto}` : siteUrl

  // Actualizar prospecto: estado_temperatura + mover al kanban
  await admin.from('prospectos').update({
    estado_temperatura: 'listo_cierre',
    columna_kanban:     'propuesta_enviada',
    actualizado_en:     new Date().toISOString(),
  }).eq('prospecto_id', prospecto_id)

  // Registrar evento
  await admin.from('eventos_lead').insert({
    prospecto_id,
    tenant_id:  p.tenant_id,
    tipo:       'listo_cierre',
    payload: {
      resumen_agente,
      link_chat:    linkChat,
      columna_anterior: p.columna_kanban,
    },
  })

  // Encolar notificación al socio (alerta de timbre)
  await _encolArAlertaSocio(p, resumen_agente, linkChat, admin)

  const alerta = _buildAlertaCierre(p, resumen_agente, linkChat)
  return alerta
}

// ─── 3. Leer alertas pendientes del socio ─────────────────────────────────────

export async function leerAlertasCierre(socio_id: string, tenant_id: string): Promise<AlertaCierre[]> {
  const admin = db()

  const { data } = await admin
    .from('eventos_lead')
    .select(`
      id, prospecto_id, payload, creado_en,
      prospectos!inner(nombre, telefono, correo, campana_id)
    `)
    .eq('tenant_id', tenant_id)
    .eq('tipo', 'listo_cierre')
    .eq('procesado', false)
    .in('prospecto_id', admin
      .from('prospectos')
      .select('prospecto_id')
      .eq('socio_id', socio_id)
    )
    .order('creado_en', { ascending: false })
    .limit(20)

  if (!data) return []

  return (data as unknown[]).map((ev: unknown) => {
    const e = ev as Record<string, unknown>
    const payload = (e.payload as Record<string, unknown>) ?? {}
    const p = (e.prospectos as Record<string, unknown>) ?? {}
    return {
      prospecto_id:   e.prospecto_id as string,
      nombre:         (p.nombre as string) ?? '',
      telefono:       (p.telefono as string | null) ?? null,
      correo:         (p.correo  as string | null) ?? null,
      resumen_agente: (payload.resumen_agente as string | null) ?? null,
      link_chat:      (payload.link_chat as string) ?? '',
      campana_id:     (p.campana_id as string | null) ?? null,
      creado_en:      e.creado_en as string,
    }
  })
}

export async function marcarAlertaProcesada(evento_id: string): Promise<void> {
  await db().from('eventos_lead').update({ procesado: true }).eq('id', evento_id)
}

// ─── Templates de mensajes ────────────────────────────────────────────────────

/**
 * Genera los templates de captura para WhatsApp y Email.
 * Se llaman "de secuestro" porque llevan al lead al canal controlado.
 */
async function _buildMensajesCaptura(lead: DatosLead): Promise<unknown[]> {
  const admin    = db()
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const mensajes: unknown[] = []

  // Obtener link corto de afiliado
  const { data: link } = await admin
    .from('links_afiliados')
    .select('id_corto')
    .eq('socio_id', lead.socio_id)
    .eq('campana_id', lead.campana_id)
    .limit(1)
    .single()

  const idCorto  = (link as { id_corto: string } | null)?.id_corto ?? null
  const linkLanding = idCorto ? `${siteUrl}/c/${idCorto}` : siteUrl

  // Obtener nombre del socio
  const { data: socio } = await admin
    .from('socios')
    .select('nombre_completo')
    .eq('usuario_id', lead.socio_id)
    .single()

  const nombreSocio = (socio as { nombre_completo: string } | null)?.nombre_completo ?? 'tu consultor'

  // Template WhatsApp
  if (lead.telefono) {
    mensajes.push({
      prospecto_id: lead.prospecto_id,
      tenant_id:    lead.tenant_id,
      canal:        'whatsapp',
      destinatario: lead.telefono,
      cuerpo:       templateWhatsApp(lead.nombre, nombreSocio, linkLanding),
    })
  }

  // Template Email
  if (lead.correo) {
    mensajes.push({
      prospecto_id: lead.prospecto_id,
      tenant_id:    lead.tenant_id,
      canal:        'email',
      destinatario: lead.correo,
      asunto:       `${lead.nombre}, tienes un mensaje de ${nombreSocio}`,
      cuerpo:       templateEmail(lead.nombre, nombreSocio, linkLanding),
    })
  }

  return mensajes
}

async function _encolArAlertaSocio(
  prospecto: Record<string, unknown>,
  resumen:   string | null,
  linkChat:  string,
  admin:     ReturnType<typeof db>,
): Promise<void> {
  // Obtener datos del socio para notificarlo
  const { data: socio } = await admin
    .from('socios')
    .select('correo, telefono, nombre_completo')
    .eq('usuario_id', prospecto.socio_id)
    .single()

  if (!socio) return
  const s = socio as Record<string, unknown>

  const cuerpoSocio = templateAlertaCierreSocio(
    prospecto.nombre as string,
    prospecto.telefono as string | null,
    prospecto.correo  as string | null,
    resumen,
    linkChat,
  )

  if (s.correo) {
    await admin.from('notificaciones_leads').insert({
      prospecto_id: prospecto.prospecto_id,
      tenant_id:    prospecto.tenant_id,
      canal:        'email',
      destinatario: s.correo,
      asunto:       `🔔 CIERRE LISTO — ${prospecto.nombre} está listo para comprar`,
      cuerpo:       cuerpoSocio,
    })
  }
}

function _buildAlertaCierre(
  p: Record<string, unknown>,
  resumen: string | null,
  linkChat?: string,
): AlertaCierre {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return {
    prospecto_id:   p.prospecto_id as string,
    nombre:         p.nombre as string,
    telefono:       (p.telefono as string | null) ?? null,
    correo:         (p.correo  as string | null) ?? null,
    resumen_agente: resumen,
    link_chat:      linkChat ?? siteUrl,
    campana_id:     (p.campana_id as string | null) ?? null,
    creado_en:      p.creado_en as string,
  }
}

// ─── Templates de texto ───────────────────────────────────────────────────────

export function templateWhatsApp(nombre: string, consultor: string, link: string): string {
  return `Hola ${nombre} 👋

Te escribe el equipo de ${consultor}.

Tenemos información personalizada sobre soluciones de salud y bienestar que pueden interesarte.

Haz clic aquí para conocer más y hablar directamente con nuestro asistente:
👉 ${link}

¡Es rápido y sin compromisos! 😊`
}

export function templateEmail(nombre: string, consultor: string, link: string): string {
  return `Hola ${nombre},

Mi nombre es ${consultor} y me gustaría compartir contigo información sobre soluciones de salud y bienestar.

Haz clic en el siguiente enlace para conocer más:
${link}

Nuestro asistente virtual está disponible 24/7 para responder tus preguntas.

Saludos,
${consultor}`
}

export function templateAlertaCierreSocio(
  nombreLead:   string,
  telefonoLead: string | null,
  correoLead:   string | null,
  resumen:      string | null,
  linkChat:     string,
): string {
  return `🔔 ALERTA DE CIERRE — ${nombreLead} está listo para comprar

DATOS DEL LEAD:
• Nombre:    ${nombreLead}
• Teléfono:  ${telefonoLead ?? 'No disponible'}
• Email:     ${correoLead  ?? 'No disponible'}

RESUMEN DEL AGENTE:
${resumen ?? '(sin resumen disponible)'}

LINK DIRECTO AL CHAT:
${linkChat}

⚡ Acción recomendada: Contacta ahora en menos de 5 minutos para maximizar la conversión.`
}
