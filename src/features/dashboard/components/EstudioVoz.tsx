'use client'

/**
 * EstudioVoz — Teleprompter + Normalización + Gestión de Frases Maestras
 *
 * Pipeline al subir audio:
 *  1. Decodificar con Web Audio API
 *  2. Aplicar: HPF 80Hz + compresión + normalización -14 LUFS + limiter -1dBTP
 *  3. Resamplear → 44 100 Hz WAV
 *  4. Calcular métricas (LUFS, SNR, peak, duración)
 *  5. Subir archivo normalizado + métricas al servidor
 *  6. Si SNR < 10 dB → mostrar aviso "ambiente ruidoso"
 */

import { useState, useEffect, useRef } from 'react'
import {
  Mic, Upload, Play, Pause, Trash2, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, Loader2, AlertTriangle,
} from 'lucide-react'
import type { AudioMetadata } from '@/features/dashboard/services/audio-processor.service'

// Importación dinámica — evita SSR del módulo Web Audio
let procesarAudioFn: ((file: File) => Promise<{ blob: Blob; filename: string; metadata: AudioMetadata }>) | null = null
async function getProcessor() {
  if (!procesarAudioFn) {
    const mod = await import('@/features/dashboard/services/audio-processor.service')
    procesarAudioFn = mod.procesarAudio
  }
  return procesarAudioFn
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AudioFrase {
  id:                   string
  clave:                string
  guion:                string
  audio_url:            string | null
  estado:               'pendiente' | 'validado' | 'rechazado'
  snr_estimado:         number | null
  lufs_estimado:        number | null
  pico_db:              number | null
  duracion_segundos:    number | null
  requiere_regrabacion: boolean
}

// ─── Configuración de estado visual ──────────────────────────────────────────

const ESTADO_CFG = {
  pendiente: { label: 'En revisión', Icon: Clock,        cls: 'text-amber-500  bg-amber-50  border-amber-200'  },
  validado:  { label: 'Aprobado',    Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  rechazado: { label: 'Rechazado',   Icon: XCircle,      cls: 'text-red-500    bg-red-50    border-red-200'    },
}

function snrColor(snr: number | null) {
  if (snr === null) return 'text-gray-400'
  if (snr >= 20)    return 'text-emerald-600'
  if (snr >= 10)    return 'text-amber-500'
  return 'text-red-500'
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EstudioVoz() {
  const [frases,      setFrases]      = useState<AudioFrase[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [playing,     setPlaying]     = useState<string | null>(null)
  const [processing,  setProcessing]  = useState<string | null>(null)  // normalizando
  const [uploading,   setUploading]   = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)
  const [savingGuion, setSavingGuion] = useState<string | null>(null)
  const [editGuion,   setEditGuion]   = useState<Record<string, string>>({})
  const [warningClave, setWarningClave] = useState<string | null>(null)  // SNR warning
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const inputRefs  = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch('/api/socio/audios')
      .then(r => r.json())
      .then((data: AudioFrase[]) => {
        setFrases(data)
        const g: Record<string, string> = {}
        data.forEach(f => { g[f.clave] = f.guion })
        setEditGuion(g)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Upload con normalización ───────────────────────────────────────────────

  const handleUpload = async (clave: string, file: File) => {
    setWarningClave(null)

    // 1. Normalizar en el cliente
    setProcessing(clave)
    const procesar = await getProcessor()
    const { blob, filename, metadata } = await procesar(file).finally(() => setProcessing(null))

    // 2. Subir archivo normalizado + métricas
    setUploading(clave)
    const form = new FormData()
    form.append('clave',    clave)
    form.append('file',     blob, filename)
    form.append('metadata', JSON.stringify(metadata))

    try {
      const res = await fetch('/api/socio/audios/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Error al subir')

      const json = await res.json() as { requiere_regrabacion?: boolean }

      // 3. Mostrar aviso si calidad pobre
      if (json.requiere_regrabacion) setWarningClave(clave)

      // 4. Refrescar lista
      const r2   = await fetch('/api/socio/audios')
      const data = await r2.json() as AudioFrase[]
      setFrases(data)
      const g: Record<string, string> = {}
      data.forEach(f => { g[f.clave] = f.guion })
      setEditGuion(g)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setUploading(null)
      if (inputRefs.current[clave]) inputRefs.current[clave]!.value = ''
    }
  }

  // ── Borrar audio ──────────────────────────────────────────────────────────

  const handleDelete = async (clave: string) => {
    if (!confirm('¿Eliminar este audio? Volverá a estado pendiente.')) return
    setDeleting(clave)
    try {
      const res = await fetch(`/api/socio/audios/${encodeURIComponent(clave)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Error')
      setFrases(prev =>
        prev.map(f => f.clave === clave
          ? { ...f, audio_url: null, estado: 'pendiente', snr_estimado: null, lufs_estimado: null, pico_db: null, duracion_segundos: null, requiere_regrabacion: false }
          : f),
      )
      setWarningClave(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  // ── Reproducir audio ──────────────────────────────────────────────────────

  const handlePlayPause = async (frase: AudioFrase) => {
    if (!frase.audio_url) return

    if (playing === frase.clave) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }

    let url = frase.audio_url
    if (!url.startsWith('http')) {
      const res  = await fetch(`/api/socio/audios/signed-url?path=${encodeURIComponent(url)}`)
      const data = await res.json() as { url?: string }
      url = data.url ?? url
    }

    audioRef.current?.pause()
    const audio      = new Audio(url)
    audioRef.current = audio
    audio.onended    = () => setPlaying(null)
    audio.onerror    = () => setPlaying(null)
    await audio.play().catch(() => setPlaying(null))
    setPlaying(frase.clave)
  }

  // ── Guardar guion ─────────────────────────────────────────────────────────

  const handleSaveGuion = async (clave: string) => {
    setSavingGuion(clave)
    try {
      await fetch('/api/socio/audios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clave, guion: editGuion[clave] ?? '' }),
      })
    } finally {
      setSavingGuion(null)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Banner introductorio */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="w-4 h-4 text-violet-500" />
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Estudio de Voz</p>
        </div>
        <p className="text-[11px] text-violet-500 leading-relaxed">
          Graba cada frase en tu propia voz. El audio se normaliza automáticamente antes de subirse.
          El equipo lo revisa y activa. Mientras tanto el agente usa TTS con tu estilo.
        </p>
      </div>

      {/* Lista de frases */}
      {frases.map(frase => {
        const cfg    = ESTADO_CFG[frase.estado]
        const isOpen = expanded === frase.clave
        const busy   = processing === frase.clave || uploading === frase.clave

        return (
          <div
            key={frase.clave}
            className={`border rounded-2xl overflow-hidden transition-colors ${
              frase.requiere_regrabacion ? 'border-amber-300' : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <button
              onClick={() => setExpanded(isOpen ? null : frase.clave)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                  <cfg.Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <span className="text-xs font-semibold text-gray-700 capitalize">
                  {frase.clave.replace(/_/g, ' ')}
                </span>
                {frase.requiere_regrabacion && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" />Ruido detectado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Badge SNR */}
                {frase.snr_estimado !== null && (
                  <span className={`text-[10px] font-mono font-semibold ${snrColor(frase.snr_estimado)}`}>
                    SNR {frase.snr_estimado}dB
                  </span>
                )}
                {frase.audio_url && !frase.requiere_regrabacion && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Audio</span>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Body expandido */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">

                {/* Alerta de calidad pobre */}
                {(warningClave === frase.clave || frase.requiere_regrabacion) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">Audio con interferencia</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        Tu audio tiene demasiado ruido de fondo. Por favor intenta en un lugar más silencioso,
                        preferiblemente con audífonos y micrófono externo.
                      </p>
                      {frase.snr_estimado !== null && (
                        <p className="text-[10px] text-amber-500 mt-1 font-mono">
                          SNR detectado: {frase.snr_estimado} dB · Mínimo requerido: 10 dB
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Métricas de calidad */}
                {frase.snr_estimado !== null && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'SNR',       value: `${frase.snr_estimado}dB`,       ok: frase.snr_estimado >= 10   },
                      { label: 'LUFS',      value: `${frase.lufs_estimado}`,         ok: (frase.lufs_estimado ?? -70) > -20 },
                      { label: 'Peak',      value: `${frase.pico_db}dB`,            ok: (frase.pico_db ?? -70) < -0.5 },
                      { label: 'Duración',  value: `${frase.duracion_segundos}s`,    ok: true },
                    ].map(m => (
                      <div key={m.label} className={`text-center p-2 rounded-xl border ${m.ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-[9px] uppercase tracking-wider text-gray-400">{m.label}</p>
                        <p className={`text-xs font-bold font-mono mt-0.5 ${m.ok ? 'text-green-700' : 'text-red-600'}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Teleprompter / Guion */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Guion — lee esto mientras grabas
                  </p>
                  <textarea
                    value={editGuion[frase.clave] ?? frase.guion}
                    onChange={e => setEditGuion(p => ({ ...p, [frase.clave]: e.target.value }))}
                    rows={3}
                    className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                  />
                  <button
                    onClick={() => handleSaveGuion(frase.clave)}
                    disabled={savingGuion === frase.clave}
                    className="mt-1 text-[10px] text-violet-600 hover:text-violet-800 font-semibold disabled:opacity-50"
                  >
                    {savingGuion === frase.clave ? 'Guardando…' : 'Guardar guion'}
                  </button>
                </div>

                {/* Nota de rechazo admin */}
                {frase.estado === 'rechazado' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-red-600 font-semibold">Audio rechazado por el equipo</p>
                    <p className="text-[11px] text-red-500 mt-0.5">Graba un nuevo audio y vuelve a subirlo.</p>
                  </div>
                )}

                {/* Reproductor */}
                {frase.audio_url && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayPause(frase)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 transition-colors"
                    >
                      {playing === frase.clave
                        ? <><Pause  className="w-3.5 h-3.5" />Pausar</>
                        : <><Play   className="w-3.5 h-3.5" />Probar audio</>
                      }
                    </button>
                    {frase.duracion_segundos !== null && (
                      <span className="text-[10px] text-gray-400 font-mono">{frase.duracion_segundos}s</span>
                    )}
                    <button
                      onClick={() => handleDelete(frase.clave)}
                      disabled={deleting === frase.clave}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ml-auto"
                    >
                      {deleting === frase.clave
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2  className="w-3.5 h-3.5" />
                      }
                      Eliminar
                    </button>
                  </div>
                )}

                {/* Botón de upload */}
                <div>
                  <input
                    ref={el => { inputRefs.current[frase.clave] = el }}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    id={`upload-${frase.clave}`}
                    disabled={busy}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(frase.clave, file)
                    }}
                  />
                  <label
                    htmlFor={`upload-${frase.clave}`}
                    className={`flex items-center justify-center gap-2 w-full text-xs font-semibold rounded-xl py-2.5 border transition-colors ${
                      busy
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 cursor-pointer'
                    }`}
                  >
                    {processing === frase.clave ? (
                      <><Loader2  className="w-3.5 h-3.5 animate-spin" />Normalizando audio…</>
                    ) : uploading === frase.clave ? (
                      <><Loader2  className="w-3.5 h-3.5 animate-spin" />Subiendo…</>
                    ) : (
                      <><Upload   className="w-3.5 h-3.5" />{frase.audio_url ? 'Reemplazar audio' : 'Subir audio'}</>
                    )}
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1 text-center">
                    MP3, WAV, WebM · máx 25 MB · se normaliza automáticamente a -14 LUFS
                  </p>
                </div>

              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
