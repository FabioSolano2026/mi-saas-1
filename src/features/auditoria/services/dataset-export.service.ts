/**
 * Motor de Aprendizaje — Dataset Export Service
 *
 * Exporta interacciones de leads con "Cierre Exitoso" (columna_kanban = 'cliente_activo')
 * a .claude/memory/dataset_cierre/ para alimentar futuras mejoras del agente.
 *
 * Solo ejecutar server-side con service_role (bypassa RLS).
 *
 * Uso:
 *   import { exportarDatasetCierre } from '@/features/auditoria/services/dataset-export.service'
 *   const resultado = await exportarDatasetCierre(tenant_id)
 */

import { createClient } from '@supabase/supabase-js'
import fs   from 'fs/promises'
import path from 'path'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EntradaDataset {
  meta: {
    prospecto_id:        string
    nombre:              string
    telefono:            string | null
    correo:              string | null
    campana_id:          string | null
    temperatura:         string | null
    dias_hasta_cierre:   number | null
    exportado_en:        string
  }
  interacciones: Array<{
    tipo:               'texto' | 'voz'
    emisor:             'agente' | 'socio' | 'lead'
    contenido:          string | null
    transcripcion:      string | null
    audio_url:          string | null
    score_cumplimiento: number | null
    score_detalle:      unknown
    creado_en:          string
  }>
}

interface ResultadoExport {
  exportados:    number
  ruta:          string
  archivos:      string[]
  errores:       string[]
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export async function exportarDatasetCierre(
  tenant_id: string,
  opciones: { limite?: number } = {},
): Promise<ResultadoExport> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const errores: string[] = []
  const archivos: string[] = []

  // Directorio de destino: .claude/memory/dataset_cierre/
  const rutaBase = path.resolve(process.cwd(), '.claude', 'memory', 'dataset_cierre')
  await fs.mkdir(rutaBase, { recursive: true })

  // 1. Obtener prospectos con cierre exitoso del tenant
  const { data: prospectos, error: errP } = await supabase
    .from('prospectos')
    .select('prospecto_id, nombre, telefono, correo, campana_id, temperatura, columna_kanban, creado_en, actualizado_en')
    .eq('tenant_id', tenant_id)
    .eq('columna_kanban', 'cliente_activo')
    .limit(opciones.limite ?? 500)
    .order('actualizado_en', { ascending: false })

  if (errP || !prospectos?.length) {
    return { exportados: 0, ruta: rutaBase, archivos: [], errores: [errP?.message ?? 'Sin prospectos de cierre'] }
  }

  // 2. Por cada prospecto, obtener sus interacciones (públicas + privadas via service_role)
  for (const p of prospectos) {
    try {
      const { data: interacciones, error: errI } = await supabase
        .from('interacciones_leads')
        .select(`
          id, tipo, contenido, emisor, creado_en,
          interacciones_privado (
            audio_url, transcripcion, score_cumplimiento, score_detalle_json
          )
        `)
        .eq('prospecto_id', p.prospecto_id)
        .order('creado_en', { ascending: true })

      if (errI) { errores.push(`${p.prospecto_id}: ${errI.message}`); continue }
      if (!interacciones?.length) continue

      // Calcular días desde creación hasta cierre
      const diasHastaCierre = p.actualizado_en && p.creado_en
        ? Math.round((new Date(p.actualizado_en).getTime() - new Date(p.creado_en).getTime()) / 86400000)
        : null

      const entrada: EntradaDataset = {
        meta: {
          prospecto_id:      p.prospecto_id,
          nombre:            p.nombre,
          telefono:          p.telefono ?? null,
          correo:            p.correo ?? null,
          campana_id:        p.campana_id ?? null,
          temperatura:       p.temperatura ?? null,
          dias_hasta_cierre: diasHastaCierre,
          exportado_en:      new Date().toISOString(),
        },
        interacciones: interacciones.map((i: Record<string, unknown>) => {
          const privado = Array.isArray(i.interacciones_privado)
            ? (i.interacciones_privado[0] as Record<string, unknown> | undefined)
            : (i.interacciones_privado as Record<string, unknown> | undefined)
          return {
            tipo:               i.tipo as 'texto' | 'voz',
            emisor:             i.emisor as 'agente' | 'socio' | 'lead',
            contenido:          (i.contenido as string | null) ?? null,
            transcripcion:      (privado?.transcripcion as string | null) ?? null,
            audio_url:          (privado?.audio_url as string | null) ?? null,
            score_cumplimiento: (privado?.score_cumplimiento as number | null) ?? null,
            score_detalle:      privado?.score_detalle_json ?? null,
            creado_en:          i.creado_en as string,
          }
        }),
      }

      // Guardar como JSON (un archivo por prospecto)
      const nombreArchivo = `${p.prospecto_id}.json`
      const rutaArchivo   = path.join(rutaBase, nombreArchivo)
      await fs.writeFile(rutaArchivo, JSON.stringify(entrada, null, 2), 'utf-8')
      archivos.push(nombreArchivo)

    } catch (e) {
      errores.push(`${p.prospecto_id}: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  }

  // 3. Generar índice JSONL (dataset plano para fine-tuning)
  await _generarIndiceJSONL(rutaBase, archivos)

  return {
    exportados: archivos.length,
    ruta:       rutaBase,
    archivos,
    errores,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera dataset_index.jsonl — formato de pares turno/respuesta listo para fine-tuning.
 * Cada línea: {"messages": [{"role":"user","content":"..."}, {"role":"assistant","content":"..."}]}
 */
async function _generarIndiceJSONL(rutaBase: string, archivos: string[]): Promise<void> {
  const lineas: string[] = []

  for (const archivo of archivos) {
    try {
      const raw     = await fs.readFile(path.join(rutaBase, archivo), 'utf-8')
      const entrada = JSON.parse(raw) as EntradaDataset

      // Agrupar por pares: lead → agente (turno de conversación)
      let leadMsg   = ''
      for (const i of entrada.interacciones) {
        const texto = i.transcripcion ?? i.contenido ?? ''
        if (!texto.trim()) continue

        if (i.emisor === 'lead' || i.emisor === 'socio') {
          leadMsg = texto
        } else if (i.emisor === 'agente' && leadMsg) {
          lineas.push(JSON.stringify({
            messages: [
              { role: 'user',      content: leadMsg },
              { role: 'assistant', content: texto   },
            ],
            meta: {
              prospecto_id:      entrada.meta.prospecto_id,
              score_cumplimiento: i.score_cumplimiento,
              cierre_exitoso:    true,
            },
          }))
          leadMsg = ''
        }
      }
    } catch { /* skip corrupt files */ }
  }

  if (lineas.length > 0) {
    await fs.writeFile(
      path.join(rutaBase, 'dataset_index.jsonl'),
      lineas.join('\n'),
      'utf-8',
    )
  }
}
