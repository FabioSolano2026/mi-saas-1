/**
 * Flujo de Afiliación MLM
 *
 * Gestiona el proceso completo desde la intención de compra hasta el registro:
 *
 *  1. Agente detecta [AFILIACION_LISTA] → llama a iniciarFlujoAfiliacion()
 *  2. Se genera el Script de Afiliación personalizado
 *  3. Se registra en tabla 'afiliaciones'
 *  4. Se notifica al socio con todos los datos
 */

import { createClient } from '@supabase/supabase-js'
import type { IdentidadSocio } from '@/features/agente/services/identity.service'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ScriptAfiliacion {
  tipo:                'automatico' | 'callcenter'
  id_afiliado:         string
  nombre_socio:        string
  mensaje_lead:        string    // Lo que el agente dice al lead
  instrucciones_agente: string   // Instrucciones internas para el agente
  link_registro:       string | null
  telefono_callcenter: string | null
  script_llamada:      string | null  // Solo cuando tipo = 'callcenter'
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function iniciarFlujoAfiliacion(
  prospecto_id: string,
  identidad:    IdentidadSocio,
  campana_nombre: string,
): Promise<ScriptAfiliacion> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Obtener datos del prospecto
  const { data: prospecto } = await db
    .from('prospectos')
    .select('nombre, telefono, correo, tenant_id, socio_id, campana_id')
    .eq('prospecto_id', prospecto_id)
    .single()

  if (!prospecto) throw new Error('Prospecto no encontrado')
  const p = prospecto as Record<string, unknown>

  // Construir script
  const script = _buildScript(identidad, campana_nombre)

  // Registrar afiliación en tabla
  await db.from('afiliaciones').insert({
    prospecto_id,
    socio_id:         p.socio_id,
    tenant_id:        p.tenant_id,
    campana_id:       p.campana_id,
    id_afiliado_usado: identidad.id_afiliado,
    tipo_cierre:      identidad.tipo_cierre,
    estado:           'pendiente',
  }).onConflict('prospecto_id').ignore()

  // Registrar evento en embudo
  await db.from('eventos_lead').insert({
    prospecto_id,
    tenant_id: p.tenant_id,
    tipo:      'listo_cierre',
    payload: {
      tipo_cierre:    identidad.tipo_cierre,
      id_afiliado:    identidad.id_afiliado,
      link_registro:  script.link_registro,
      campana_nombre,
    },
  })

  // Notificar al socio
  await _notificarSocioAfiliacion(p, identidad, script, db)

  return script
}

// ─── Builder de scripts ───────────────────────────────────────────────────────

function _buildScript(
  identidad:      IdentidadSocio,
  campana_nombre: string,
): ScriptAfiliacion {
  if (identidad.tipo_cierre === 'automatico') {
    return _buildScriptAutomatico(identidad, campana_nombre)
  }
  return _buildScriptCallCenter(identidad, campana_nombre)
}

function _buildScriptAutomatico(
  identidad:      IdentidadSocio,
  campana_nombre: string,
): ScriptAfiliacion {
  const link = identidad.portal_registro_url ?? identidad.callcenter_url

  const mensajeLead = identidad.mensaje_cierre_custom
    ?? `¡Perfecto! Te voy a guiar paso a paso para completar tu registro en el programa ${campana_nombre}.

📋 Para registrarte correctamente y asegurarte de trabajar directamente con ${identidad.nombre}, necesitarás el siguiente código:

🆔 **ID de Socio: ${identidad.id_afiliado}**

${link ? `➡️ Haz clic aquí para registrarte: ${link}\n\nCuando el formulario te pida un "ID de patrocinador" o "código de referido", ingresa exactamente: **${identidad.id_afiliado}**` : `Tu especialista ${identidad.nombre} te enviará el link de registro directamente.`}

¿Tienes alguna pregunta antes de comenzar?`

  return {
    tipo:                'automatico',
    id_afiliado:         identidad.id_afiliado,
    nombre_socio:        identidad.nombre,
    mensaje_lead:        mensajeLead,
    instrucciones_agente: `Guía al lead paso a paso por el proceso de registro.
Asegúrate de que ingrese el ID ${identidad.id_afiliado} como patrocinador.
Si tiene dudas técnicas, responde con calma. Si pregunta por costos, confirma los del programa.`,
    link_registro:       link ?? null,
    telefono_callcenter: identidad.callcenter_telefono,
    script_llamada:      null,
  }
}

function _buildScriptCallCenter(
  identidad:      IdentidadSocio,
  campana_nombre: string,
): ScriptAfiliacion {
  const tel = identidad.callcenter_telefono ?? 'el número que tu especialista te indicará'

  const scriptLlamada = `📞 SCRIPT DE LLAMADA — ${campana_nombre}

Cuando llames al CallCenter (${tel}), di exactamente esto:

---
"Hola, llamo para registrarme en el programa ${campana_nombre}.
Mi patrocinador es **${identidad.nombre}**, con ID de afiliado **${identidad.id_afiliado}**.
Código de referido: ${identidad.id_afiliado}"
---

⚠️ Es importante mencionar el ID ${identidad.id_afiliado} para que tu registro quede vinculado correctamente con tu especialista.

¿Tienes el número a la mano? ¿Hay algo que quieras preguntar antes de llamar?`

  const mensajeLead = identidad.mensaje_cierre_custom ?? `¡Excelente decisión! 🎉

Para completar tu registro en ${campana_nombre} y asegurarte de quedar con ${identidad.nombre} como tu especialista personal, necesitas hacer una breve llamada al CallCenter.

📞 **Número: ${tel}**
🆔 **Tu código de patrocinador: ${identidad.id_afiliado}**

He preparado un script exacto de lo que debes decir para que todo salga perfecto:`

  return {
    tipo:                'callcenter',
    id_afiliado:         identidad.id_afiliado,
    nombre_socio:        identidad.nombre,
    mensaje_lead:        mensajeLead,
    instrucciones_agente: `El lead necesita llamar al CallCenter. Entrégale el script completo.
Asegúrate de que memorice o anote el ID ${identidad.id_afiliado}.
Ofrécete a responder dudas antes y después de la llamada.`,
    link_registro:        identidad.portal_registro_url ?? null,
    telefono_callcenter:  identidad.callcenter_telefono ?? null,
    script_llamada:       scriptLlamada,
  }
}

// ─── Notificación al socio ────────────────────────────────────────────────────

async function _notificarSocioAfiliacion(
  prospecto:  Record<string, unknown>,
  identidad:  IdentidadSocio,
  script:     ScriptAfiliacion,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:         any,
): Promise<void> {
  // Obtener correo del socio
  const { data: socio } = await db
    .from('socios')
    .select('correo, telefono')
    .eq('usuario_id', prospecto.socio_id)
    .single()

  if (!socio) return
  const s = socio as Record<string, unknown>

  const nombreLead = (prospecto.nombre as string) ?? 'Lead'
  const telLead    = (prospecto.telefono as string | null) ?? null

  const cuerpo = `🎯 REGISTRO EN PROCESO — ${nombreLead}

Lead: ${nombreLead}
Teléfono: ${telLead ?? 'no disponible'}
Email: ${(prospecto.correo as string | null) ?? 'no disponible'}

Tu ID de afiliado usado: ${identidad.id_afiliado}
Tipo de cierre: ${script.tipo === 'callcenter' ? 'CallCenter' : 'Automático (online)'}

${script.tipo === 'callcenter'
  ? `El lead está listo para llamar al CallCenter (${identidad.callcenter_telefono ?? 'número pendiente'}).
Asegúrate de estar disponible por si tiene dudas.`
  : `El lead fue dirigido al portal de registro con tu ID.
Verifica en el sistema del CallCenter/empresa que el registro aparezca con tu código.`}

⚡ Tiempo de acción: Los próximos 15 minutos son críticos para que complete el registro.`

  if (s.correo) {
    await db.from('notificaciones_leads').insert({
      prospecto_id: prospecto.prospecto_id,
      tenant_id:    prospecto.tenant_id,
      canal:        'email',
      destinatario: s.correo,
      asunto:       `🎯 ${nombreLead} está listo para registrarse con tu ID ${identidad.id_afiliado}`,
      cuerpo,
    })
  }
}

// ─── Obtener resumen de afiliaciones del socio ────────────────────────────────

export async function obtenerAfiliacionesSocio(socio_id: string, tenant_id: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data } = await db
    .from('afiliaciones')
    .select(`
      id, estado, tipo_cierre, id_afiliado_usado, creado_en, completado_en,
      prospectos!inner(nombre, telefono, correo)
    `)
    .eq('socio_id', socio_id)
    .eq('tenant_id', tenant_id)
    .order('creado_en', { ascending: false })
    .limit(50)

  return data ?? []
}
