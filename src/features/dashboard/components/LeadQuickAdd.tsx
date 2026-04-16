'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, Loader2, CheckCircle2, UserPlus, ChevronDown, BookOpen } from 'lucide-react'

interface LeadQuickAddProps {
  campanaId:     string | null
  campanaNombre: string
  onCreado:      () => void
}

interface FilaLead {
  nombre:      string
  telefono:    string
  temperatura: 'frio' | 'tibio' | 'caliente'
}

const TEMP_OPTS = [
  { value: 'frio',     label: 'Frío',     color: 'text-blue-600 bg-blue-50 border-blue-200'   },
  { value: 'tibio',    label: 'Tibio',    color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'caliente', label: 'Caliente', color: 'text-red-600 bg-red-50 border-red-200'       },
] as const

const FILA_VACIA: FilaLead = { nombre: '', telefono: '', temperatura: 'frio' }

export function LeadQuickAdd({ campanaId, campanaNombre, onCreado }: LeadQuickAddProps) {
  const [abierto,           setAbierto]           = useState(false)
  const [filas,             setFilas]             = useState<FilaLead[]>([{ ...FILA_VACIA }])
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState('')
  const [exito,             setExito]             = useState(0)
  // Contexto histórico
  const [contextoAbierto,   setContextoAbierto]   = useState(false)
  const [historialContexto, setHistorialContexto] = useState('')
  const [audioUrl,          setAudioUrl]          = useState('')
  const primerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (abierto) setTimeout(() => primerInput.current?.focus(), 50)
  }, [abierto])

  const actualizarFila = (i: number, campo: keyof FilaLead, valor: string) =>
    setFilas(f => f.map((r, idx) => idx === i ? { ...r, [campo]: valor } : r))

  const agregarFila = () => setFilas(f => [...f, { ...FILA_VACIA }])

  const eliminarFila = (i: number) =>
    setFilas(f => f.length === 1 ? f : f.filter((_, idx) => idx !== i))

  const handleEnviar = async () => {
    if (!campanaId) return
    const validos = filas.filter(f => f.nombre.trim())
    if (!validos.length) { setError('Ingresa al menos un nombre.'); return }

    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = { campana_id: campanaId, leads: validos }

      if (historialContexto.trim().length >= 10) {
        body.contexto_previo = {
          historial: historialContexto.trim(),
          ...(audioUrl.trim() ? { audio_url: audioUrl.trim() } : {}),
        }
      }

      const res = await fetch('/api/dashboard/leads/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al crear leads')
      const { creados } = await res.json()
      setExito(creados)
      setFilas([{ ...FILA_VACIA }])
      setHistorialContexto('')
      setAudioUrl('')
      setContextoAbierto(false)
      onCreado()
      setTimeout(() => { setExito(0); setAbierto(false) }, 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const puedeEnviar = campanaId && filas.some(f => f.nombre.trim()) && !loading

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(true)}
        disabled={!campanaId}
        title={campanaId ? `Agregar leads a ${campanaNombre}` : 'Selecciona una campaña primero'}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all"
      >
        <UserPlus className="w-4 h-4" />
        <span className="hidden sm:inline">Agregar leads</span>
      </button>

      {/* Panel flotante */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Volcado rápido de leads</p>
                <p className="text-xs text-gray-400 mt-0.5">{campanaNombre}</p>
              </div>
              <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filas */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {exito > 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  <p className="text-sm font-semibold text-gray-700">{exito} lead{exito > 1 ? 's' : ''} creado{exito > 1 ? 's' : ''}</p>
                </div>
              ) : (
                <>
                  {/* Cabecera de columnas */}
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-1">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Nombre *</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Teléfono</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Temp.</p>
                    <div className="w-6" />
                  </div>

                  {filas.map((fila, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <input
                        ref={i === 0 ? primerInput : undefined}
                        type="text"
                        value={fila.nombre}
                        onChange={e => actualizarFila(i, 'nombre', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && i === filas.length - 1 && agregarFila()}
                        placeholder="Nombre"
                        disabled={loading}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 placeholder:text-gray-300"
                      />
                      <input
                        type="tel"
                        value={fila.telefono}
                        onChange={e => actualizarFila(i, 'telefono', e.target.value)}
                        placeholder="+506..."
                        disabled={loading}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 placeholder:text-gray-300"
                      />
                      <select
                        value={fila.temperatura}
                        onChange={e => actualizarFila(i, 'temperatura', e.target.value as FilaLead['temperatura'])}
                        disabled={loading}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 bg-white"
                      >
                        {TEMP_OPTS.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => eliminarFila(i)}
                        disabled={filas.length === 1 || loading}
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 disabled:opacity-0 transition-colors rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={agregarFila}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1 disabled:opacity-50 transition-colors py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar fila
                  </button>

                  {/* ── Contexto previo (colapsable) ── */}
                  <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setContextoAbierto(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                        Contexto histórico previo
                        {historialContexto.trim().length >= 10 && (
                          <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">
                            activo
                          </span>
                        )}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${contextoAbierto ? 'rotate-180' : ''}`} />
                    </button>

                    {contextoAbierto && (
                      <div className="px-3 pb-3 space-y-2 bg-violet-50/50">
                        <p className="text-[11px] text-violet-600 pt-2">
                          El agente leerá esto antes de iniciar la conversación para no repetir lo ya conversado.
                        </p>
                        <textarea
                          value={historialContexto}
                          onChange={e => setHistorialContexto(e.target.value)}
                          placeholder="Ej: &quot;Le escribí por WhatsApp el lunes, le interesa el producto para bajar de peso, pero dijo que quería pensarlo. Tiene 45 años, tiene diabetes tipo 2...&quot;"
                          rows={4}
                          disabled={loading}
                          className="w-full text-xs border border-violet-200 rounded-lg px-3 py-2 bg-white text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none disabled:opacity-50"
                        />
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={e => setAudioUrl(e.target.value)}
                          placeholder="URL del audio previo (opcional)"
                          disabled={loading}
                          className="w-full text-xs border border-violet-200 rounded-lg px-3 py-2 bg-white text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {exito === 0 && (
              <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAbierto(false)}
                    className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEnviar}
                    disabled={!puedeEnviar}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{historialContexto.trim().length >= 10 ? 'Procesando…' : 'Creando…'}</>
                      : <><UserPlus className="w-3.5 h-3.5" />Crear {filas.filter(f => f.nombre.trim()).length || ''} leads</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
