/**
 * GET /api/admin/leads/resumen/[id_lead]
 *   → Devuelve el resumen ejecutivo actual + flag resumen_validado del lead.
 *
 * PUT /api/admin/leads/resumen/[id_lead]
 *   Body: { resumen?: string, resumen_validado?: boolean }
 *   → Admin edita el texto del resumen y/o activa la "luz verde".
 *
 * Acceso: solo socios con rol = 'auditor' o 'admin'.
 */

import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminDb(): any {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function verificarAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('tenant_id, rol')
    .eq('usuario_id', user.id)
    .single()
  const s = socio as { tenant_id: string; rol: string } | null
  return s?.rol && s.rol !== 'socio' ? s : null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id_lead: string }> },
) {
  const { id_lead } = await params
  const supabase = await createClient()
  const admin_ctx = await verificarAdmin(supabase)
  if (!admin_ctx) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const db = adminDb()

  // Verificar que el lead pertenece al tenant del auditor
  const { data: prospecto, error: errP } = await db
    .from('prospectos')
    .select('prospecto_id, nombre, resumen_validado, tenant_id')
    .eq('prospecto_id', id_lead)
    .eq('tenant_id', admin_ctx.tenant_id)
    .single()

  if (errP || !prospecto) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Obtener el último resumen ejecutivo
  const { data: resumenRow } = await db
    .from('interacciones_leads')
    .select('id, contenido, creado_en, actualizado_en')
    .eq('prospecto_id', id_lead)
    .eq('es_historia', true)
    .eq('es_resumen', true)
    .order('creado_en', { ascending: false })
    .limit(1)
    .single()

  // Obtener también el contexto original
  const { data: contextoRow } = await db
    .from('interacciones_leads')
    .select('contenido, creado_en')
    .eq('prospecto_id', id_lead)
    .eq('tipo', 'contexto_inicial')
    .order('creado_en', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    prospecto_id:     (prospecto as Record<string, unknown>).prospecto_id,
    nombre:           (prospecto as Record<string, unknown>).nombre,
    resumen_validado: (prospecto as Record<string, unknown>).resumen_validado,
    resumen: resumenRow ? {
      id:            (resumenRow as Record<string, unknown>).id,
      texto:         (resumenRow as Record<string, unknown>).contenido,
      creado_en:     (resumenRow as Record<string, unknown>).creado_en,
    } : null,
    contexto_original: contextoRow
      ? (contextoRow as Record<string, unknown>).contenido
      : null,
  })
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

const UpdateSchema = z.object({
  resumen:          z.string().min(10).max(5000).optional(),
  resumen_validado: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id_lead: string }> },
) {
  const { id_lead } = await params
  const supabase = await createClient()
  const admin_ctx = await verificarAdmin(supabase)
  if (!admin_ctx) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const parsed = UpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  if (!parsed.data.resumen && parsed.data.resumen_validado === undefined) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const db = adminDb()

  // Verificar tenant
  const { data: prospecto } = await db
    .from('prospectos')
    .select('prospecto_id, tenant_id')
    .eq('prospecto_id', id_lead)
    .eq('tenant_id', admin_ctx.tenant_id)
    .single()

  if (!prospecto) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const resultados: Record<string, unknown> = {}

  // 1. Actualizar resumen_validado en prospectos (si se provee)
  if (parsed.data.resumen_validado !== undefined) {
    const { error: errV } = await db
      .from('prospectos')
      .update({ resumen_validado: parsed.data.resumen_validado })
      .eq('prospecto_id', id_lead)

    if (errV) return NextResponse.json({ error: errV.message }, { status: 500 })
    resultados.resumen_validado = parsed.data.resumen_validado
  }

  // 2. Actualizar texto del resumen en interacciones_leads (si se provee)
  if (parsed.data.resumen) {
    // Buscar fila existente del resumen
    const { data: resumenExistente } = await db
      .from('interacciones_leads')
      .select('id')
      .eq('prospecto_id', id_lead)
      .eq('es_historia', true)
      .eq('es_resumen', true)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    if (resumenExistente) {
      // Actualizar fila existente
      const { error: errR } = await db
        .from('interacciones_leads')
        .update({ contenido: parsed.data.resumen })
        .eq('id', (resumenExistente as { id: string }).id)

      if (errR) return NextResponse.json({ error: errR.message }, { status: 500 })
      resultados.resumen_id = (resumenExistente as { id: string }).id
    } else {
      // Crear nuevo resumen (lead sin historial previo — el admin carga uno manualmente)
      const { data: campana } = await db
        .from('prospectos')
        .select('campana_id, tenant_id')
        .eq('prospecto_id', id_lead)
        .single()

      const { data: nuevo, error: errN } = await db
        .from('interacciones_leads')
        .insert({
          prospecto_id: id_lead,
          campana_id:   (campana as Record<string, unknown>)?.campana_id ?? null,
          tenant_id:    admin_ctx.tenant_id,
          tipo:         'texto',
          contenido:    parsed.data.resumen,
          emisor:       'agente',
          es_historia:  true,
          es_resumen:   true,
        })
        .select('id')
        .single()

      if (errN) return NextResponse.json({ error: errN.message }, { status: 500 })
      resultados.resumen_id = (nuevo as { id: string }).id
    }

    resultados.resumen_texto = parsed.data.resumen
  }

  return NextResponse.json({ ok: true, ...resultados })
}
