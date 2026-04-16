/**
 * GET /api/auditoria/logs
 *
 * Devuelve audit_logs paginados con filtros opcionales:
 *   ?fecha_desde=YYYY-MM-DD
 *   &fecha_hasta=YYYY-MM-DD
 *   &motivo=texto libre (busca en razon)
 *   &accion=ARCHIVE|RESTORE|AUTO_MARK_INACTIVE
 *   &page=1
 *   &page_size=20
 *
 * Seguridad:
 *   - Requiere sesión activa + tier != 'free'
 *   - tenant_id del JWT — no suplantable
 *   - RLS en audit_logs filtra por tenant_id del JWT también en BD
 */

import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import { TIERS_CON_ACCESO_AUDITORIA } from '@/features/auditoria/types/auditoria.types'
import type { SocioTier } from '@/features/auditoria/types/auditoria.types'

const FiltrosSchema = z.object({
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  motivo:      z.string().max(200).optional(),
  accion:      z.enum(['ARCHIVE', 'RESTORE', 'AUTO_MARK_INACTIVE']).optional(),
  page:        z.coerce.number().int().min(1).default(1),
  page_size:   z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: Request) {
  const supabase = await createClient()

  // 1. Sesión
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  // 2. tenant_id del JWT
  console.log('--- DEBUG JWT CLAIMS (LOGS) ---');
  console.log('User ID:', user.id);
  console.log('App Metadata:', JSON.stringify(user.app_metadata, null, 2));
  console.log('User Metadata:', JSON.stringify(user.user_metadata, null, 2));

  let tenantId = (user.app_metadata?.tenant_id as string | undefined) ??
                 (user.user_metadata?.tenant_id as string | undefined) ??
                 null;

  // 3. Guard de tier (server-side) y obtener tenant_id si no está en JWT
  const { data: socio } = await supabase
    .from('socios')
    .select('tier, tenant_id')
    .eq('usuario_id', user.id)
    .single()

  if (!tenantId && socio?.tenant_id) {
    tenantId = socio.tenant_id
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id no encontrado en JWT. Verificar Auth Hook.', debug: { app: user.app_metadata, user: user.user_metadata } },
      { status: 403 }
    );
  }

  const tier = socio?.tier as SocioTier | undefined
  if (!tier || !TIERS_CON_ACCESO_AUDITORIA.includes(tier)) {
    return NextResponse.json(
      { error: 'Acceso denegado. Se requiere un plan premium.' },
      { status: 403 }
    )
  }

  // 4. Validar query params
  const url     = new URL(request.url)
  const params  = Object.fromEntries(url.searchParams.entries())
  const parsed  = FiltrosSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parámetros inválidos.', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { fecha_desde, fecha_hasta, motivo, accion, page, page_size } = parsed.data
  const offset = (page - 1) * page_size

  // 5. Construir query con filtros opcionales
  let query = supabase
    .from('audit_logs' as any)
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + page_size - 1)

  if (fecha_desde) {
    query = query.gte('timestamp', `${fecha_desde}T00:00:00.000Z`)
  }
  if (fecha_hasta) {
    query = query.lte('timestamp', `${fecha_hasta}T23:59:59.999Z`)
  }
  if (motivo) {
    // Búsqueda insensible a mayúsculas en el campo razon
    query = query.ilike('razon', `%${motivo}%`)
  }
  if (accion) {
    query = query.eq('accion', accion)
  }

  const { data: logs, count, error: queryError } = await query

  if (queryError) {
    return NextResponse.json(
      { error: queryError.message ?? 'Error al obtener los logs.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    logs:      logs ?? [],
    total:     count ?? 0,
    page,
    page_size,
  })
}
