'use client'

import { Loader2, Play, Pause, RefreshCw, AlertCircle, Zap } from 'lucide-react'
import { useCatalogoCampanas } from '../hooks/useCatalogoCampanas'
import type { CampanaConEstado } from '../types/dashboard.types'

interface CatalogoCampanasProps {
  onSeleccionar: (campana: CampanaConEstado) => void
  campanaSeleccionadaId: string | null
}

export function CatalogoCampanas({ onSeleccionar, campanaSeleccionadaId }: CatalogoCampanasProps) {
  const { campanas, loading, error, toggleCampana, toggling, recargar } = useCatalogoCampanas()

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertCircle className="w-5 h-5 text-red-400" />
      <p className="text-xs text-red-500">{error}</p>
      <button onClick={recargar} className="text-xs text-gray-500 underline">Reintentar</button>
    </div>
  )

  if (campanas.length === 0) return (
    <div className="py-12 text-center">
      <p className="text-sm text-gray-400">No hay campañas disponibles para tu tipo de negocio.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Catálogo de Campañas</h2>
        <button onClick={recargar} className="text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {campanas.map((c) => {
        const activa    = c.estado_socio === 'activo'
        const pausada   = c.estado_socio === 'pausado'
        const enToggle  = toggling === c.campana_id
        const seleccionada = campanaSeleccionadaId === c.campana_id

        return (
          <div
            key={c.campana_id}
            onClick={() => activa && onSeleccionar(c)}
            className={`
              rounded-xl border p-4 transition-all
              ${seleccionada
                ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                : activa
                  ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer'
                  : 'border-gray-100 bg-gray-50 opacity-70'}
            `}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <Zap className={`w-3.5 h-3.5 shrink-0 ${activa ? 'text-blue-500' : 'text-gray-300'}`} />
                  <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                </div>

                {c.descripcion && (
                  <p className="text-xs text-gray-400 line-clamp-2 ml-5">{c.descripcion}</p>
                )}

                <div className="flex items-center gap-2 mt-2 ml-5 flex-wrap">
                  {c.condicion && (
                    <span className="text-[11px] bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                      {c.condicion}
                    </span>
                  )}
                  <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {c.agente_tipo}
                  </span>
                  {c.requiere_cita && (
                    <span className="text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">
                      Con cita
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleCampana(c.campana_id) }}
                disabled={enToggle}
                className={`
                  shrink-0 flex items-center gap-1.5 text-xs font-medium
                  px-3 py-1.5 rounded-lg border transition-all
                  ${enToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${activa
                    ? 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                    : pausada
                      ? 'bg-white border-gray-200 text-gray-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
                      : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                {enToggle
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : activa
                    ? <><Pause  className="w-3 h-3" />Pausar</>
                    : pausada
                      ? <><Play   className="w-3 h-3" />Reanudar</>
                      : <><Play   className="w-3 h-3" />Activar</>
                }
              </button>
            </div>

            {/* Badge estado */}
            {c.estado_socio && (
              <div className="mt-2 ml-5">
                <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full
                  ${activa ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {activa ? '● Activa' : '○ Pausada'}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
