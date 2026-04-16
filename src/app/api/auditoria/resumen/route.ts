/**
 * GET /api/auditoria/resumen
 *
 * Devuelve las métricas para las summary cards del AuditorDashboard:
 *   - total_activos: prospectos en tabla activa del tenant
 *   - total_historico: registros en prospectos_historico del tenant
 *   - tasa_archivo_semana: % archivados esta semana vs. acumulado
 *   - ultimos_lotes: últimos 5 lotes únicos (archivo_lote_id)
 *
 * Seguridad:
 *   - Requiere sesión activa
 *   - Requiere tier != 'free' (verificado server-side contra socios)
 *   - tenant_id del JWT — no suplantable
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TIERS_CON_ACCESO_AUDITORIA } from '@/features/auditoria/types/auditoria.types'
import type { SocioTier } from '@/features/auditoria/types/auditoria.types'

export async function GET() {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  // 2. Obtener tenant_id del JWT (inyectado por custom_access_token_hook)
  console.log('--- DEBUG JWT CLAIMS ---');
  console.log('User ID:', user.id);
  console.log('App Metadata:', JSON.stringify(user.app_metadata, null, 2));
  console.log('User Metadata:', JSON.stringify(user.user_metadata, null, 2));

  let tenantId = (user.app_metadata?.tenant_id as string | undefined) ??
    (user.user_metadata?.tenant_id as string | undefined) ??
    null;

  // 3. Verificar tier del socio (server-side) y obtener tenant_id si no está en JWT
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
      { error: 'Acceso denegado. Se requiere un plan premium para ver la auditoría.' },
      { status: 403 }
    )
  }

  // 4. Contar prospectos activos
  const { count: totalActivos } = await supabase
    .from('prospectos')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // 5. Contar prospectos en histórico
  const { count: totalHistorico } = await supabase
    .from('prospectos_historico')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // 6. Archivados esta semana
  const inicioDeSemana = new Date()
  inicioDeSemana.setDate(inicioDeSemana.getDate() - 7)

  const { count: archivadosSemana } = await supabase
    .from('prospectos_historico')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('fecha_archivado', inicioDeSemana.toISOString())

  const total = totalHistorico ?? 0
  const semana = archivadosSemana ?? 0
  const tasaArchivoSemana = total > 0 ? Math.round((semana / total) * 100) : 0

  // 7. Últimos 5 lotes únicos — agrupados por archivo_lote_id
  // Supabase JS no soporta GROUP BY directamente — lo hacemos con SQL via rpc
  // Usamos select con order + dedup en JS para evitar una función PG extra
  const { data: lotesRaw } = await supabase
    .from('prospectos_historico')
    .select('archivo_lote_id, fecha_archivado, motivo_archivado')
    .eq('tenant_id', tenantId)
    .order('fecha_archivado', { ascending: false })
    .limit(200) // traemos suficientes para dedup los 5 últimos lotes

  // Agrupar por lote_id y contar registros
  const lotesMap = new Map<string, {
    archivo_lote_id: string
    fecha_archivado: string
    motivo_archivado: string
    total_registros: number
  }>()

  for (const row of (lotesRaw ?? [])) {
    const loteId = row.archivo_lote_id
    if (lotesMap.has(loteId)) {
      lotesMap.get(loteId)!.total_registros++
    } else {
      lotesMap.set(loteId, {
        archivo_lote_id: loteId,
        fecha_archivado: row.fecha_archivado,
        motivo_archivado: row.motivo_archivado,
        total_registros: 1,
      })
    }
  }

  const ultimosLotes = Array.from(lotesMap.values()).slice(0, 5)

  return NextResponse.json({
    total_activos: totalActivos ?? 0,
    total_historico: totalHistorico ?? 0,
    tasa_archivo_semana: tasaArchivoSemana,
    ultimos_lotes: ultimosLotes,
  })
}
