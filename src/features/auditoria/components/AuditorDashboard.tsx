'use client'

import { useState } from 'react'
import {
  Archive, RotateCcw, RefreshCw, Loader2,
  AlertCircle, ChevronLeft, ChevronRight,
  Users, FolderOpen, TrendingDown, ListChecks,
  CheckCircle2, Search, X,
} from 'lucide-react'
import { Button }                      from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuditorDashboard }         from '../hooks/useAuditorDashboard'
import { archivarProspectos }          from '../services/archiver.service'
import type { AuditLog, LoteArchivo }  from '../types/auditoria.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatLoteId(id: string) {
  return id.slice(0, 8) + '…'
}

const ACCION_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ARCHIVE: {
    label: 'Archivado',
    dot:   'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  AUTO_MARK_INACTIVE: {
    label: 'Inactivo automático',
    dot:   'bg-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  RESTORE: {
    label: 'Restaurado',
    dot:   'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl border border-gray-200 bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="py-4 px-6 flex gap-4 items-center">
          <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 flex-1 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Error ────────────────────────────────────────────────────────────────────

function ErrorBox({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const esSesion = mensaje.toLowerCase().includes('sesión') || mensaje.toLowerCase().includes('sesion')
  const esAcceso = mensaje.toLowerCase().includes('acceso') || mensaje.toLowerCase().includes('premium')

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm w-full text-center">
        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">
          {esSesion ? 'Sesión expirada' : esAcceso ? 'Acceso denegado' : 'Error al cargar'}
        </p>
        <p className="text-xs text-red-400 mb-4">{mensaje}</p>
        {esSesion ? (
          <Button size="sm" variant="destructive" onClick={() => (window.location.href = '/login')}>
            Iniciar sesión
          </Button>
        ) : !esAcceso ? (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  titulo: string
  valor: string | number
  subtitulo?: string
  icon: React.ReactNode
  colorClass?: string
}

function MetricCard({ titulo, valor, subtitulo, icon, colorClass = 'text-gray-800' }: MetricCardProps) {
  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardDescription className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
            {titulo}
          </CardDescription>
          <div className="text-gray-300">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className={`text-2xl font-bold tracking-tight ${colorClass}`}>{valor}</div>
        {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Modal de restaurar ───────────────────────────────────────────────────────

interface RestaurarModalProps {
  prospectoId: string
  nombre?: string
  onConfirmar: () => void
  onCancelar: () => void
  cargando: boolean
}

function RestaurarModal({ prospectoId, nombre, onConfirmar, onCancelar, cargando }: RestaurarModalProps) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-50 rounded-xl p-2.5 shrink-0">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Restaurar prospecto</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {nombre
                ? <>¿Restaurar a <span className="font-medium text-gray-700">{nombre}</span>?</>
                : <>¿Restaurar <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{formatLoteId(prospectoId)}</code>?</>
              }
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl p-3.5 leading-relaxed">
          El registro volverá a la columna <strong className="text-gray-700">nuevo_prospecto</strong> con días sin
          contacto en 0. El histórico <strong className="text-gray-700">no se borra</strong> — queda como evidencia.
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={cargando}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100">
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirmar} disabled={cargando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none">
            {cargando
              ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Restaurando…</>
              : <><RotateCcw className="w-3 h-3 mr-1.5" />Confirmar</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Tabla de audit_logs ──────────────────────────────────────────────────────

interface TablaLogsProps {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  onCambiarPagina: (p: number) => void
  onRestaurar: (log: AuditLog) => void
  restaurando: boolean
  hayBusqueda: boolean
}

function TablaLogs({ logs, total, page, pageSize, onCambiarPagina, onRestaurar, restaurando, hayBusqueda }: TablaLogsProps) {
  const totalPaginas = Math.ceil(total / pageSize)

  if (logs.length === 0) {
    return (
      <div className="text-center py-14">
        <Search className="w-7 h-7 mx-auto mb-3 text-gray-200" />
        <p className="text-sm text-gray-400">
          {hayBusqueda
            ? 'No se encontraron procesos que coincidan con tu búsqueda.'
            : 'No hay registros con los filtros actuales.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left pb-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                Fecha
              </th>
              <th className="text-left pb-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Estado
              </th>
              <th className="text-left pb-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Prospecto
              </th>
              <th className="text-left pb-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Razón
              </th>
              <th className="pb-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const cfg = ACCION_CONFIG[log.accion]
              return (
                <tr key={log.log_id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 text-xs text-gray-400 whitespace-nowrap tabular-nums">
                    {formatFecha(log.timestamp)}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg?.badge ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg?.dot ?? 'bg-gray-400'}`} />
                      {cfg?.label ?? log.accion}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <code className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-mono">
                      {formatLoteId(log.prospecto_id)}
                    </code>
                  </td>
                  <td className="py-4 px-4 text-xs text-gray-500 max-w-xs truncate">
                    {log.razon ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {(log.accion === 'ARCHIVE' || log.accion === 'AUTO_MARK_INACTIVE') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRestaurar(log)}
                        disabled={restaurando}
                      >
                        <RotateCcw className="w-3 h-3 mr-1.5" />
                        Restaurar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between pt-1 text-xs text-gray-400">
        <span>{total.toLocaleString('es-CR')} registro{total !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-gray-200 hover:bg-gray-50"
            onClick={() => onCambiarPagina(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="tabular-nums">Pág. {page} / {totalPaginas || 1}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-gray-200 hover:bg-gray-50"
            onClick={() => onCambiarPagina(page + 1)} disabled={page >= totalPaginas}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Últimos lotes ────────────────────────────────────────────────────────────

function UltimosLotes({ lotes }: { lotes: LoteArchivo[] }) {
  if (lotes.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">Sin lotes de archivo.</p>
  }
  return (
    <div className="divide-y divide-gray-100">
      {lotes.map((lote) => (
        <div key={lote.archivo_lote_id} className="flex items-center gap-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-700 truncate">{lote.motivo_archivado}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatFecha(lote.fecha_archivado)}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-sm font-semibold text-gray-700 tabular-nums">{lote.total_registros}</span>
            <p className="text-xs text-gray-400">registros</p>
          </div>
          <code className="text-[11px] bg-gray-100 text-gray-400 px-2 py-1 rounded-lg font-mono shrink-0">
            {formatLoteId(lote.archivo_lote_id)}
          </code>
        </div>
      ))}
    </div>
  )
}

// ─── Archivar manualmente ─────────────────────────────────────────────────────

function ArchivarForm({ onExito }: { onExito: () => void }) {
  const [prospectoId, setProspectoId] = useState('')
  const [loading, setLoading]         = useState(false)
  const [feedback, setFeedback]       = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  const handleArchivar = async () => {
    const id = prospectoId.trim()
    if (!id) return
    setLoading(true)
    setFeedback(null)
    try {
      await archivarProspectos({ id })
      setFeedback({ tipo: 'ok', texto: 'Prospecto archivado correctamente.' })
      setProspectoId('')
      onExito()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setFeedback({ tipo: 'err', texto: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={prospectoId}
          onChange={(e) => setProspectoId(e.target.value)}
          placeholder="UUID del prospecto a archivar…"
          disabled={loading}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50 font-mono"
        />
        <Button
          size="sm"
          onClick={handleArchivar}
          disabled={loading || !prospectoId.trim()}
          className="bg-gray-800 hover:bg-gray-900 text-white shadow-none shrink-0 text-xs"
        >
          {loading
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Archivando…</>
            : <><Archive className="w-3 h-3 mr-1.5" />Archivar</>
          }
        </Button>
      </div>

      {feedback && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 border ${
          feedback.tipo === 'ok'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-600'
        }`}>
          {feedback.tipo === 'ok'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          }
          <span>{feedback.texto}</span>
        </div>
      )}
    </div>
  )
}

// ─── AuditorDashboard ─────────────────────────────────────────────────────────

export function AuditorDashboard() {
  const {
    resumen, logsResult, filtros,
    loadingResumen, loadingLogs,
    errorResumen, errorLogs, errorRestaurar,
    actualizarFiltros, cambiarPagina, restaurar, recargar, restaurando,
  } = useAuditorDashboard()

  const [logParaRestaurar, setLogParaRestaurar] = useState<AuditLog | null>(null)

  const [busqueda, setBusqueda]               = useState('')

  const confirmarRestaura = async () => {
    if (!logParaRestaurar) return
    await restaurar(logParaRestaurar.prospecto_id)
    setLogParaRestaurar(null)
  }

  // Filtrado client-side — opera sobre la página actual sin llamar a la BD
  const q = busqueda.trim().toLowerCase()
  const logsFiltrados = logsResult?.logs.filter((log) => {
    if (!q) return true
    return (
      log.prospecto_id.toLowerCase().includes(q) ||
      (log.razon?.toLowerCase().includes(q) ?? false) ||
      (typeof log.metadata?.nombre === 'string' && log.metadata.nombre.toLowerCase().includes(q))
    )
  }) ?? []

  // Bloqueo por error crítico de acceso
  const errorCritico =
    errorResumen?.toLowerCase().includes('acceso') ||
    errorResumen?.toLowerCase().includes('premium') ||
    errorResumen?.toLowerCase().includes('sesión')
  if (errorCritico && errorResumen) {
    return <ErrorBox mensaje={errorResumen} onReintentar={recargar} />
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800 tracking-tight">
            Auditoría — Ciclo de Vida
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Supervisión del archivo, restauración y trail de acciones sobre prospectos.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={recargar}
          disabled={loadingResumen}
          className="border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 shadow-none text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${loadingResumen ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Barra de búsqueda global ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar prospecto por nombre, ID o razón…"
          className="w-full text-xs border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white shadow-sm"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      {loadingResumen ? (
        <SummarySkeleton />
      ) : errorResumen ? (
        <ErrorBox mensaje={errorResumen} onReintentar={recargar} />
      ) : resumen ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            titulo="Prospectos activos"
            valor={resumen.total_activos.toLocaleString('es-CR')}
            subtitulo="En tabla prospectos"
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard
            titulo="En histórico"
            valor={resumen.total_historico.toLocaleString('es-CR')}
            subtitulo="Archivados acumulado"
            icon={<FolderOpen className="w-4 h-4" />}
            colorClass="text-gray-600"
          />
          <MetricCard
            titulo="Tasa archivo (7 d)"
            valor={`${resumen.tasa_archivo_semana}%`}
            subtitulo="Archivados esta semana"
            icon={<TrendingDown className="w-4 h-4" />}
            colorClass={resumen.tasa_archivo_semana > 20 ? 'text-red-500' : 'text-gray-700'}
          />
          <MetricCard
            titulo="Último lote"
            valor={resumen.ultimos_lotes[0]?.total_registros ?? 0}
            subtitulo={resumen.ultimos_lotes[0]
              ? `Archivado ${formatFecha(resumen.ultimos_lotes[0].fecha_archivado)}`
              : 'Sin lotes registrados'}
            icon={<Archive className="w-4 h-4" />}
            colorClass="text-amber-600"
          />
        </div>
      ) : null}

      {/* ── Segunda fila: lotes + archivar manual ── */}
      {resumen && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Últimos lotes — 3 col */}
          <Card className="lg:col-span-3 border border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-gray-300" />
                Últimos lotes de archivo
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <UltimosLotes lotes={resumen.ultimos_lotes} />
            </CardContent>
          </Card>

          {/* Archivar manualmente — 2 col */}
          <Card className="lg:col-span-2 border border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-gray-300" />
                Archivar manualmente
              </CardTitle>
              <CardDescription className="text-[11px] text-gray-400 leading-relaxed">
                Mueve un prospecto al histórico de forma inmediata.
                En producción se recomienda usar el RPC <code className="font-mono">archivar_prospectos()</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <ArchivarForm onExito={recargar} />
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── Audit trail ── */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardHeader className="pb-3 pt-5 px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                <ListChecks className="w-3.5 h-3.5 text-gray-300" />
                Audit trail
              </CardTitle>
              <CardDescription className="text-[11px] text-gray-400 mt-0.5">
                Historial inmutable de todas las acciones sobre prospectos.
              </CardDescription>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 pt-3">
            <input
              type="date"
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
              onChange={(e) => actualizarFiltros({ fecha_desde: e.target.value || undefined })}
            />
            <input
              type="date"
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
              onChange={(e) => actualizarFiltros({ fecha_hasta: e.target.value || undefined })}
            />
            <input
              type="text"
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 min-w-[160px]"
              placeholder="Buscar por razón…"
              onChange={(e) => actualizarFiltros({ motivo: e.target.value || undefined })}
            />
            <select
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
              onChange={(e) => actualizarFiltros({
                accion: (e.target.value || undefined) as typeof filtros.accion,
              })}
            >
              <option value="">Todas las acciones</option>
              <option value="ARCHIVE">Archivado</option>
              <option value="AUTO_MARK_INACTIVE">Inactivo automático</option>
              <option value="RESTORE">Restaurado</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-0 space-y-4">
          {/* Error de restaurar */}
          {errorRestaurar && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errorRestaurar}
            </div>
          )}

          {/* Tabla */}
          {loadingLogs ? (
            <TableSkeleton />
          ) : errorLogs ? (
            <p className="text-xs text-red-500 py-6 text-center">{errorLogs}</p>
          ) : logsResult ? (
            <TablaLogs
              logs={logsFiltrados}
              total={q ? logsFiltrados.length : logsResult.total}
              page={logsResult.page}
              pageSize={logsResult.page_size}
              onCambiarPagina={cambiarPagina}
              onRestaurar={setLogParaRestaurar}
              restaurando={restaurando}
              hayBusqueda={!!q}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* ── Modal de restaurar ── */}
      {logParaRestaurar && (
        <RestaurarModal
          prospectoId={logParaRestaurar.prospecto_id}
          onConfirmar={confirmarRestaura}
          onCancelar={() => setLogParaRestaurar(null)}
          cargando={restaurando}
        />
      )}
    </div>
  )
}
