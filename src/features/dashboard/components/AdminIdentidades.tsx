'use client'

/**
 * AdminIdentidades — Lista de socios con estado de aprobación de identidad.
 *
 * Muestra: nombre, id_afiliado, voz_aprobada, avatar_aprobado, audios pendientes.
 * Enlaza a /admin/perfil/[socio_id] para revisar y aprobar cada socio.
 * BotonSuplantar: inicia auditoría de sesión temporal del socio.
 */

import { useState, useEffect }  from 'react'
import Link                      from 'next/link'
import { CheckCircle2, Clock, ChevronRight, AlertTriangle, RefreshCw, Loader2, Filter } from 'lucide-react'
import { BotonSuplantar }        from '@/components/admin/BotonSuplantar'

interface SocioIdentidad {
  socio_id:         string
  nombre:           string
  foto_url:         string | null
  id_afiliado:      string
  voz_aprobada:     boolean
  avatar_aprobado:  boolean
  voz_clonada_id:   string | null
  nota_validacion:  string | null
  validado_en:      string | null
  audios: {
    total:    number
    pendiente:number
    validado: number
    rechazado:number
  }
  pendiente_revision: boolean
}

function EstadoBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok
    ? <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />{label}</span>
    : <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400  bg-gray-50   border border-gray-200   rounded-full px-2 py-0.5"><Clock        className="w-3 h-3" />{label}</span>
}

export function AdminIdentidades() {
  const [socios,         setSocios]         = useState<SocioIdentidad[]>([])
  const [loading,        setLoading]        = useState(true)
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [errorSuplant,   setErrorSuplant]   = useState<string | null>(null)

  const cargar = async (filtro: boolean) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/identidades${filtro ? '?solo_pendientes=true' : ''}`)
      const data = await res.json() as { socios?: SocioIdentidad[] }
      setSocios(data.socios ?? [])
    } catch {
      setSocios([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar(false) }, [])

  const toggle = () => {
    const nuevo = !soloPendientes
    setSoloPendientes(nuevo)
    cargar(nuevo)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Controles */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
            soloPendientes
              ? 'bg-amber-50 text-amber-700 border-amber-300'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Pendientes de revisión
        </button>
        <button
          onClick={() => cargar(soloPendientes)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Error de auditoría */}
      {errorSuplant && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {errorSuplant}
        </div>
      )}

      {socios.length === 0 && (
        <div className="text-center py-10 text-xs text-gray-400">
          {soloPendientes ? 'No hay identidades pendientes de revisión.' : 'No hay socios registrados.'}
        </div>
      )}

      {socios.map(s => (
        <Link
          key={s.socio_id}
          href={`/admin/perfil/${s.socio_id}`}
          className={`flex items-center gap-4 p-4 bg-white border rounded-2xl hover:shadow-sm transition-all group ${
            s.pendiente_revision ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
          }`}
        >
          {/* Avatar inicial */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
            {s.nombre.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-800 truncate">{s.nombre}</p>
              <code className="text-[10px] font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                {s.id_afiliado}
              </code>
              {s.pendiente_revision && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" />Pendiente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <EstadoBadge ok={s.voz_aprobada}   label="Voz aprobada"    />
              <EstadoBadge ok={s.avatar_aprobado} label="Avatar aprobado" />
              {s.audios.total > 0 && (
                <span className="text-[10px] text-gray-500">
                  Audios: <strong>{s.audios.validado}</strong>✓
                  {s.audios.pendiente > 0 && <> · <strong className="text-amber-500">{s.audios.pendiente}</strong> pendientes</>}
                  {s.audios.rechazado > 0 && <> · <strong className="text-red-500">{s.audios.rechazado}</strong> rechazados</>}
                </span>
              )}
              {s.audios.total === 0 && (
                <span className="text-[10px] text-gray-400">Sin audios subidos</span>
              )}
            </div>
          </div>

          {/* Auditar sesión */}
          <BotonSuplantar
            socioId={s.socio_id}
            socioNombre={s.nombre}
            onError={setErrorSuplant}
          />

          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
        </Link>
      ))}
    </div>
  )
}
