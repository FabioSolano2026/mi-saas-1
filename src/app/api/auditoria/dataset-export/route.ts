/**
 * POST /api/auditoria/dataset-export
 * Exporta el dataset de cierres exitosos a .claude/memory/dataset_cierre/
 * Solo accesible para auditores o service_role.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exportarDatasetCierre } from '@/features/auditoria/services/dataset-export.service'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('tenant_id, rol')
    .eq('usuario_id', user.id)
    .single()

  if (((socio as { rol?: string } | null)?.rol ?? 'socio') === 'socio') {
    return NextResponse.json({ error: 'Acceso denegado — solo auditores' }, { status: 403 })
  }

  const tenantId = (socio as { tenant_id: string }).tenant_id
  const resultado = await exportarDatasetCierre(tenantId)

  return NextResponse.json(resultado)
}
