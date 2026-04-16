/**
 * slack.service.ts
 *
 * Servicio de notificaciones Slack para auditoría del Ciclo de Vida.
 * Solo se puede importar desde código de servidor (API Routes, Server Components).
 * Nunca desde componentes 'use client' — el webhook URL es un secret de servidor.
 *
 * Configuración:
 *   Variable de entorno: SLACK_AUDIT_WEBHOOK_URL
 *   Obtener en: https://api.slack.com/apps → Tu app → Incoming Webhooks
 *
 * Diseño de resiliencia:
 *   - Fire-and-forget: una falla de Slack NUNCA bloquea ni revierte la operación principal.
 *   - Timeout de 5 segundos: si Slack no responde, el proceso continúa.
 *   - Errores de Slack se loguean con console.error — visibles en Vercel logs.
 *   - Nunca lanzar excepciones hacia el caller.
 */

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  fields?: Array<{ type: string; text: string }>
  elements?: Array<{ type: string; text: { type: string; text: string } }>
}

interface SlackPayload {
  text: string        // fallback de texto plano (notificaciones móviles, accesibilidad)
  blocks?: SlackBlock[]
}

// ─── Helper de envío ─────────────────────────────────────────────────────────

/**
 * Envía cualquier payload Block Kit a SLACK_AUDIT_WEBHOOK_URL.
 * Retorna true si Slack respondió 200, false en cualquier otro caso.
 *
 * NUNCA lanza excepciones — el caller no necesita try/catch.
 * Si SLACK_AUDIT_WEBHOOK_URL no está configurada, simplemente no hace nada.
 */
async function sendSlackPayload(payload: SlackPayload): Promise<boolean> {
  const webhookUrl = process.env.SLACK_AUDIT_WEBHOOK_URL

  if (!webhookUrl) {
    // Variable no configurada — silencio intencional en desarrollo local
    // sin la variable. No es un error.
    return false
  }

  try {
    const controller = new AbortController()
    // Timeout de 5 s: Slack puede tener latencia puntual.
    // No queremos bloquear la respuesta al cliente más de esto.
    const timeoutId = setTimeout(() => controller.abort(), 5_000)

    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error(`[Slack] HTTP ${res.status} al enviar notificación.`)
      return false
    }

    return true
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Slack] Timeout: la notificación no se entregó en 5 s.')
    } else {
      console.error('[Slack] Error inesperado:', err)
    }
    return false
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Mensaje genérico de texto plano.
 * Útil para notificaciones simples o pruebas del webhook.
 */
export async function sendSlackNotification(message: string): Promise<boolean> {
  return sendSlackPayload({ text: message })
}

/**
 * Notificación de lote de archivo completado exitosamente.
 * Se llama desde POST /api/kanban/archivar después de que el RPC devuelve sin error.
 */
export async function sendArchiveSuccess({
  lote_id,
  archivados,
  tenant_id,
  motivo,
  tipo,
}: {
  lote_id:   string
  archivados: number
  tenant_id: string
  motivo:    string
  tipo:      string   // 'batch_inactividad' | 'comportamental'
}): Promise<boolean> {
  // Si no hubo nada que archivar, no enviamos ruido a Slack
  if (archivados === 0) return true

  const payload: SlackPayload = {
    text: `✅ Archivo completado — ${archivados} prospecto(s) archivados. Lote: ${lote_id.slice(0, 8)}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Lote de archivo completado', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Lote ID*\n\`${lote_id.slice(0, 8)}…\`` },
          { type: 'mrkdwn', text: `*Registros archivados*\n${archivados}` },
          { type: 'mrkdwn', text: `*Tenant*\n\`${tenant_id.slice(0, 8)}…\`` },
          { type: 'mrkdwn', text: `*Criterio*\n${tipo === 'batch_inactividad' ? 'Batch inactividad' : 'Comportamental'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Motivo:* ${motivo}` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: { type: 'mrkdwn', text: `Estado: *Éxito* · ${new Date().toISOString()}` },
          },
        ],
      },
    ],
  }

  return sendSlackPayload(payload)
}

/**
 * Alerta urgente cuando el count-check falla (ROLLBACK automático).
 *
 * Este es el caso más crítico: la función PG detectó inconsistencia entre
 * los registros esperados en prospectos_historico y los encontrados.
 * El ROLLBACK garantiza integridad, pero el equipo de operaciones
 * debe investigar el origen del error de inmediato.
 */
export async function sendArchiveError({
  tenant_id,
  motivo,
  error_message,
  tipo,
}: {
  tenant_id:     string
  motivo:        string
  error_message: string
  tipo:          string
}): Promise<boolean> {
  // Detectar si es el count-check específico o un error genérico de PG
  const esCountCheck = error_message.toLowerCase().includes('count-check')

  const payload: SlackPayload = {
    text: `🚨 ERROR en archivo de prospectos — tenant: ${tenant_id.slice(0, 8)}. ${esCountCheck ? 'COUNT-CHECK FALLIDO' : 'Error de BD'}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: esCountCheck
            ? '🚨 COUNT-CHECK FALLIDO — ROLLBACK EJECUTADO'
            : '❌ Error en archivo de prospectos',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Tenant afectado*\n\`${tenant_id}\`` },
          { type: 'mrkdwn', text: `*Criterio*\n${tipo === 'batch_inactividad' ? 'Batch inactividad' : 'Comportamental'}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: esCountCheck
            ? `⚠️ *Integridad comprometida detectada*\nLa BD encontró inconsistencia entre registros esperados e insertados en \`prospectos_historico\`. El ROLLBACK automático evitó pérdida de datos.\n\n*Ningún registro fue borrado de \`prospectos\`.*`
            : `*Error al ejecutar \`archivar_prospectos()\`*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Detalle del error:*\n\`\`\`${error_message}\`\`\``,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Motivo que se intentaba procesar:* ${motivo}` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: { type: 'mrkdwn', text: `Estado: *ROLLBACK* · ${new Date().toISOString()} · Acción requerida: revisar logs de Supabase` },
          },
        ],
      },
    ],
  }

  return sendSlackPayload(payload)
}
