'use client'

import { useState } from 'react'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText, BookOpen, ChevronDown } from 'lucide-react'

interface BulkImportProps {
  campanaId:     string | null
  campanaNombre: string
  onImportado:   () => void
}

interface LeadParsed {
  nombre:   string
  telefono: string
  correo:   string
  ok:       boolean
}

// ─── Parser: acepta CSV o texto libre ────────────────────────────────────────
function parsearTexto(texto: string): LeadParsed[] {
  return texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.toLowerCase().startsWith('nombre'))
    .map(linea => {
      const sep = linea.includes(';') ? ';'
                : linea.includes('|') ? '|'
                : linea.includes(',') ? ','
                : null

      const partes = sep
        ? linea.split(sep).map(p => p.trim())
        : linea.split(/\s+/)

      const nombre   = partes[0] ?? ''
      const telefono = partes[1] ?? ''
      const correo   = partes[2] ?? ''

      return {
        nombre:   nombre.replace(/^["']|["']$/g, ''),
        telefono: telefono.replace(/^["']|["']$/g, '').replace(/\D/g, '') ? telefono.trim() : '',
        correo:   correo.includes('@') ? correo.trim() : '',
        ok:       nombre.trim().length >= 2,
      }
    })
    .filter(l => l.nombre.length > 0)
}

export function BulkImport({ campanaId, campanaNombre, onImportado }: BulkImportProps) {
  const [abierto,   setAbierto]   = useState(false)
  const [texto,     setTexto]     = useState('')
  const [preview,   setPreview]   = useState<LeadParsed[]>([])
  const [loading,   setLoading]   = useState(false)
  const [resultado, setResultado] = useState<{ creados: number; con_contexto?: boolean } | null>(null)
  const [error,     setError]     = useState('')
  // Contexto histórico del lote
  const [contextoAbierto,   setContextoAbierto]   = useState(false)
  const [historialContexto, setHistorialContexto] = useState('')
  const [audioUrl,          setAudioUrl]          = useState('')

  const handleTextoChange = (val: string) => {
    setTexto(val)
    setPreview(val.trim() ? parsearTexto(val) : [])
    setError('')
    setResultado(null)
  }

  const validos = preview.filter(p => p.ok)

  const handleCerrar = () => {
    setAbierto(false)
    setTexto('')
    setPreview([])
    setResultado(null)
    setHistorialContexto('')
    setAudioUrl('')
    setContextoAbierto(false)
  }

  const handleImportar = async () => {
    if (!campanaId || !validos.length) return
    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        campana_id: campanaId,
        leads:      validos.map(l => ({
          nombre:   l.nombre,
          telefono: l.telefono || undefined,
          correo:   l.correo   || undefined,
        })),
      }

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
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al importar')
      const data = await res.json()
      setResultado(data)
      onImportado()
      setTimeout(handleCerrar, 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón trigger */}
      <button
        onClick={() => setAbierto(true)}
        disabled={!campanaId}
        title={campanaId ? 'Importar lista de contactos' : 'Selecciona una campaña primero'}
        className="flex items-center gap-2 text-xs font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all"
      >
        <Upload className="w-3.5 h-3.5" />
        Importar lista
      </button>

      {/* Modal */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Importar contactos en lote</p>
                <p className="text-xs text-gray-400 mt-0.5">{campanaNombre}</p>
              </div>
              <button onClick={handleCerrar} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {resultado ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  <p className="text-sm font-semibold text-gray-700">
                    {resultado.creados} contacto{resultado.creados !== 1 ? 's' : ''} importado{resultado.creados !== 1 ? 's' : ''}
                  </p>
                  {resultado.con_contexto && (
                    <p className="text-xs text-violet-600 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Resumen ejecutivo generado para el agente
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Instrucciones */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />Formatos aceptados (una línea por contacto):
                    </p>
                    <p className="font-mono text-[11px] text-blue-600">Nombre, Teléfono, Email</p>
                    <p className="font-mono text-[11px] text-blue-600">Nombre | Teléfono</p>
                    <p className="font-mono text-[11px] text-blue-600">Nombre Teléfono Email</p>
                    <p className="text-[11px] text-blue-500 mt-1">Puedes pegar directo desde Excel, Google Sheets o WhatsApp.</p>
                  </div>

                  {/* Textarea de leads */}
                  <textarea
                    value={texto}
                    onChange={e => handleTextoChange(e.target.value)}
                    placeholder={'Juan Pérez, +50688887777, juan@correo.com\nMaría López, +50699996666\nCarlos Rodríguez'}
                    rows={6}
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 font-mono text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  />

                  {/* Preview */}
                  {preview.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Vista previa — {validos.length} de {preview.length} válidos
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                        {preview.slice(0, 20).map((l, i) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2 text-xs ${l.ok ? '' : 'bg-red-50'}`}>
                            {l.ok
                              ? <span className="text-emerald-500 shrink-0">✓</span>
                              : <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                            }
                            <span className="font-medium text-gray-700 truncate">{l.nombre || '—'}</span>
                            {l.telefono && <span className="text-gray-400 shrink-0">{l.telefono}</span>}
                            {l.correo   && <span className="text-gray-400 truncate">{l.correo}</span>}
                          </div>
                        ))}
                        {preview.length > 20 && (
                          <p className="text-[11px] text-gray-400 text-center py-2">
                            …y {preview.length - 20} más
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Contexto histórico del lote (colapsable) ── */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setContextoAbierto(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                        Contexto histórico del lote
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
                          Describe de dónde vienen estos leads y qué saben. El agente recibirá un resumen ejecutivo antes de cada conversación.
                        </p>
                        <textarea
                          value={historialContexto}
                          onChange={e => setHistorialContexto(e.target.value)}
                          placeholder='Ej: "Estos leads vienen de un grupo de Facebook sobre pérdida de peso. Todos tienen interés en productos naturales, varios mencionaron que ya probaron dietas sin éxito y buscan una solución definitiva..."'
                          rows={4}
                          disabled={loading}
                          className="w-full text-xs border border-violet-200 rounded-lg px-3 py-2 bg-white text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none disabled:opacity-50"
                        />
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={e => setAudioUrl(e.target.value)}
                          placeholder="URL del audio de contexto (opcional)"
                          disabled={loading}
                          className="w-full text-xs border border-violet-200 rounded-lg px-3 py-2 bg-white text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}
                </>
              )}
            </div>

            {/* Footer */}
            {!resultado && (
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={handleCerrar}
                  className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportar}
                  disabled={!validos.length || loading}
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{historialContexto.trim().length >= 10 ? 'Procesando…' : 'Importando…'}</>
                    : <><Upload className="w-3.5 h-3.5" />Importar {validos.length} contactos</>
                  }
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
