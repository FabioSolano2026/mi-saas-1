'use client'

/**
 * AdminAudiosCalidad — Dashboard de Auditoría de Calidad de Audio
 *
 * Muestra por socio: SNR promedio, LUFS, peak, duración y flag de regrabación.
 * Permite filtrar solo los que tienen problemas de calidad.
 */

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface AudioRow {
  clave:                string
  estado:               string
  tiene_audio:          boolean
  lufs_estimado:        number | null
  snr_estimado:         number | null
  pico_db:              number | null
  duracion_segundos:    number | null
  requiere_regrabacion: boolean
  actualizado_en:       string | null
}

interface SocioCalidad {
  socio_id:   string
  nombre:     string
  audios:     AudioRow[]
  resumen: {
    total:        number
    con_audio:    number
    problemas:    number
    snr_promedio: number | null
  }
}

function snrBadge(snr: number | null) {
  if (snr === null) return <span className="text-gray-300 font-mono text-xs">—</span>
  const cls = snr >= 20 ? 'text-emerald-600 bg-emerald-50' : snr >= 10 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  return <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${cls}`}>{snr}dB</span>
}

export function AdminAudiosCalidad() {
  const [socios,        setSocios]        = useState<SocioCalidad[]>([])
  const [loading,       setLoading]       = useState(true)
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [expanded,      setExpanded]      = useState<string | null>(null)

  const cargar = async (filtro: boolean) => {
    setLoading(true)
    try {
      const url = `/api/admin/audios-calidad${filtro ? '?solo_problemas=true' : ''}`
      const res  = await fetch(url)
      const data = await res.json() as { socios?: SocioCalidad[] }
      setSocios(data.socios ?? [])
    } catch {
      setSocios([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar(soloProblemas) }, [])

  const toggleFiltro = () => {
    const nuevo = !soloProblemas
    setSoloProblemas(nuevo)
    cargar(nuevo)
  }

  return (
    <div className="space-y-4">

      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFiltro}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
              soloProblemas
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Solo con problemas
          </button>
        </div>
        <button
          onClick={() => cargar(soloProblemas)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Estado cargando */}
      {loading && (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      )}

      {/* Sin resultados */}
      {!loading && socios.length === 0 && (
        <div className="text-center py-10 text-xs text-gray-400">
          {soloProblemas ? 'No hay audios con problemas de calidad.' : 'No hay audios registrados.'}
        </div>
      )}

      {/* Tabla por socio */}
      {!loading && socios.map(s => {
        const isOpen  = expanded === s.socio_id
        const tieneProblemas = s.resumen.problemas > 0

        return (
          <div
            key={s.socio_id}
            className={`border rounded-2xl overflow-hidden ${tieneProblemas ? 'border-amber-200' : 'border-gray-200'}`}
          >
            {/* Header socio */}
            <button
              onClick={() => setExpanded(isOpen ? null : s.socio_id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-800">{s.nombre}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {s.resumen.con_audio}/{s.resumen.total} frases grabadas
                  </p>
                </div>
                {tieneProblemas && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    {s.resumen.problemas} con ruido
                  </span>
                )}
                {!tieneProblemas && s.resumen.con_audio > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />Calidad OK
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[9px] text-gray-400 uppercase">SNR prom.</p>
                  {snrBadge(s.resumen.snr_promedio)}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Tabla de frases */}
            {isOpen && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Frase', 'Estado', 'SNR', 'LUFS', 'Peak', 'Duración', 'Problema'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {s.audios.map(a => (
                      <tr key={a.clave} className={a.requiere_regrabacion ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap capitalize">
                          {a.clave.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            a.estado === 'validado'  ? 'bg-emerald-100 text-emerald-700' :
                            a.estado === 'rechazado' ? 'bg-red-100    text-red-700'    :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {a.tiene_audio ? a.estado : 'sin audio'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{snrBadge(a.snr_estimado)}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {a.lufs_estimado !== null ? `${a.lufs_estimado}` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {a.pico_db !== null ? `${a.pico_db}dB` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {a.duracion_segundos !== null ? `${a.duracion_segundos}s` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {a.requiere_regrabacion
                            ? <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold"><AlertTriangle className="w-3 h-3" />Ruido</span>
                            : a.snr_estimado !== null ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
