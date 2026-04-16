/**
 * GET /api/dashboard/alertas/stream
 *
 * Server-Sent Events — Alerta de Timbre en tiempo real para el socio.
 *
 * El cliente (AlertaTimbre.tsx) conecta a este endpoint y escucha:
 *  - 'ping'         → keepalive cada 15s
 *  - 'cierre_listo' → un lead está listo para comprar (AlertaCierre payload)
 *
 * Usa polling ligero contra la tabla eventos_lead (sin websockets).
 * Compatible con Edge Runtime.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'  // necesitamos ReadableStream + setInterval

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Obtener socio_id y tenant_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('usuario_id, tenant_id')
    .eq('usuario_id', user.id)
    .single()

  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  const { tenant_id } = socio as { usuario_id: string; tenant_id: string }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Marca de tiempo de inicio: solo alertas nuevas desde ahora
  const inicioStr = new Date().toISOString()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      function send(event: string, data: unknown) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { closed = true }
      }

      // Keepalive inicial
      send('ping', { ts: Date.now() })

      // Poll cada 8 segundos
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return }

        try {
          // Verificar alertas de cierre nuevas para los leads de este socio
          const { data: eventos } = await db
            .from('eventos_lead')
            .select(`
              id, prospecto_id, payload, creado_en,
              prospectos!inner(nombre, telefono, correo, campana_id, socio_id)
            `)
            .eq('tenant_id', tenant_id)
            .eq('tipo', 'listo_cierre')
            .eq('procesado', false)
            .gte('creado_en', inicioStr)
            .eq('prospectos.socio_id', user.id)
            .order('creado_en', { ascending: true })
            .limit(5)

          if (eventos?.length) {
            for (const ev of eventos) {
              const e = ev as Record<string, unknown>
              const p = (e.prospectos as Record<string, unknown>) ?? {}
              const payload = (e.payload as Record<string, unknown>) ?? {}

              send('cierre_listo', {
                evento_id:     e.id,
                prospecto_id:  e.prospecto_id,
                nombre:        p.nombre,
                telefono:      p.telefono ?? null,
                correo:        p.correo   ?? null,
                campana_id:    p.campana_id ?? null,
                resumen:       payload.resumen_agente ?? null,
                link_chat:     payload.link_chat ?? '',
                creado_en:     e.creado_en,
              })
            }
          } else {
            // Keepalive
            send('ping', { ts: Date.now() })
          }
        } catch { /* silencioso — el cliente re-conecta */ }
      }, 8000)

      // Cerrar después de 5 minutos (el cliente re-conecta automáticamente)
      setTimeout(() => {
        clearInterval(interval)
        closed = true
        try { controller.close() } catch { /* ya cerrado */ }
      }, 5 * 60 * 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
