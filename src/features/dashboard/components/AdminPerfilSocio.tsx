'use client'

/**
 * AdminPerfilSocio — Panel de validación de identidad de un socio.
 *
 * Permite al auditor:
 *  - Aprobar / rechazar la voz clonada (voz_aprobada)
 *  - Aprobar / rechazar el avatar (avatar_aprobado)
 *  - Dejar nota de validación
 *  - Escuchar y aprobar / rechazar cada audio grabado individualmente
 *
 * Usa PUT /api/admin/perfil-identidad/[socio_id]
 */

import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2, XCircle, Play, Pause, Loader2,
  ArrowLeft, Mic2, User, Volume2, FileAudio,
} from 'lucide-react'
import Link from 'next/link'

interface AudioFrase {
  clave:               string
  estado:              'pendiente' | 'validado' | 'rechazado'
  guion:               string
  audio_url:           string | null
  signed_url:          string | null
  snr_estimado:        number | null
  lufs_estimado:       number | null
  duracion_segundos:   number | null
  nota_admin:          string | null
}

interface SocioIdentidadDetalle {
  socio: {
    nombre_completo: string
    foto_url:        string | null
    id_afiliado:     string
  } | null
  perfil: {
    voz_aprobada:    boolean
    avatar_aprobado: boolean
    voz_clonada_id:  string | null
    nota_validacion: string | null
  } | null
  audios: AudioFrase[]
}

const ESTADO_CFG = {
  pendiente: { label: 'En revisión', cls: 'text-amber-600  bg-amber-50  border-amber-200'  },
  validado:  { label: 'Aprobado',    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  rechazado: { label: 'Rechazado',   cls: 'text-red-500    bg-red-50    border-red-200'    },
}

export function AdminPerfilSocio({ socioId }: { socioId: string }) {
  const [data,        setData]       = useState<SocioIdentidadDetalle | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [saving,      setSaving]     = useState<string | null>(null)  // clave | 'perfil'
  const [playing,     setPlaying]    = useState<string | null>(null)
  const [notas,       setNotas]      = useState<Record<string, string>>({})
  const [vozAprobada, setVozAprobada] = useState(false)
  const [avatarOk,    setAvatarOk]   = useState(false)
  const [notaPerfil,  setNotaPerfil] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch(`/api/admin/perfil-identidad/${socioId}`)
      .then(r => r.json())
      .then((d: SocioIdentidadDetalle) => {
        setData(d)
        setVozAprobada(d.perfil?.voz_aprobada    ?? false)
        setAvatarOk(   d.perfil?.avatar_aprobado ?? false)
        setNotaPerfil( d.perfil?.nota_validacion ?? '')
        const n: Record<string, string> = {}
        d.audios.forEach(a => { n[a.clave] = a.nota_admin ?? '' })
        setNotas(n)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [socioId])

  const guardarPerfil = async () => {
    setSaving('perfil')
    try {
      await fetch(`/api/admin/perfil-identidad/${socioId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          voz_aprobada:    vozAprobada,
          avatar_aprobado: avatarOk,
          nota_validacion: notaPerfil,
        }),
      })
      setData(prev => prev ? {
        ...prev,
        perfil: prev.perfil
          ? { ...prev.perfil, voz_aprobada: vozAprobada, avatar_aprobado: avatarOk, nota_validacion: notaPerfil }
          : prev.perfil,
      } : prev)
    } finally {
      setSaving(null)
    }
  }

  const validarAudio = async (clave: string, estado: 'validado' | 'rechazado' | 'pendiente') => {
    setSaving(clave)
    try {
      await fetch(`/api/admin/perfil-identidad/${socioId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          audio_clave:  clave,
          audio_estado: estado,
          audio_nota:   notas[clave] ?? '',
        }),
      })
      setData(prev => prev ? {
        ...prev,
        audios: prev.audios.map(a =>
          a.clave === clave ? { ...a, estado, nota_admin: notas[clave] ?? '' } : a,
        ),
      } : prev)
    } finally {
      setSaving(null)
    }
  }

  const togglePlay = async (frase: AudioFrase) => {
    if (!frase.signed_url) return
    if (playing === frase.clave) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    audioRef.current?.pause()
    const audio      = new Audio(frase.signed_url)
    audioRef.current = audio
    audio.onended    = () => setPlaying(null)
    await audio.play().catch(() => setPlaying(null))
    setPlaying(frase.clave)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )
  if (!data) return <p className="text-xs text-red-500">No se pudo cargar el perfil.</p>

  const { socio, perfil, audios } = data

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Back */}
      <Link href="/admin" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a Admin
      </Link>

      {/* Header socio */}
      <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-200 to-violet-200 flex items-center justify-center text-lg font-bold text-blue-700">
          {socio?.nombre_completo?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">{socio?.nombre_completo}</p>
          <code className="text-xs font-mono text-gray-500 bg-white/80 rounded px-2 py-0.5 mt-1 inline-block">
            ID: {socio?.id_afiliado}
          </code>
        </div>
      </div>

      {/* ─── Sección: Identidad global ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-blue-500" />
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Identidad Global</p>
        </div>

        {/* Voz clonada */}
        {perfil?.voz_clonada_id && (
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">ID Voz Clonada (ElevenLabs)</p>
            <code className="text-xs font-mono text-gray-700">{perfil.voz_clonada_id}</code>
          </div>
        )}

        {/* Toggles de aprobación */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Voz clonada', value: vozAprobada, set: setVozAprobada, disabled: !perfil?.voz_clonada_id },
            { label: 'Avatar',      value: avatarOk,    set: setAvatarOk,    disabled: false },
          ].map(({ label, value, set, disabled }) => (
            <button
              key={label}
              disabled={disabled}
              onClick={() => set(!value)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                disabled    ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200' :
                value       ? 'bg-emerald-50 border-emerald-300' :
                              'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xs font-semibold text-gray-700">{label}</span>
              {value
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <XCircle      className="w-4 h-4 text-gray-300"    />
              }
            </button>
          ))}
        </div>

        {/* Nota de validación */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Nota de validación (visible para el socio)
          </label>
          <textarea
            value={notaPerfil}
            onChange={e => setNotaPerfil(e.target.value)}
            rows={2}
            placeholder="Ej: Voz aprobada. El avatar necesita mayor resolución."
            className="w-full mt-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none placeholder:text-gray-300"
          />
        </div>

        <button
          onClick={guardarPerfil}
          disabled={saving === 'perfil'}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 transition-colors disabled:opacity-50"
        >
          {saving === 'perfil'
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando…</>
            : 'Guardar aprobaciones de identidad'
          }
        </button>
      </div>

      {/* ─── Sección: Frases maestras ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-violet-500" />
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Frases Maestras ({audios.filter(a => a.audio_url).length} de {audios.length} grabadas)
          </p>
        </div>

        {audios.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-2xl">
            Este socio no ha subido ningún audio todavía.
          </div>
        )}

        {audios.map(frase => {
          const cfg   = ESTADO_CFG[frase.estado]
          const busy  = saving === frase.clave

          return (
            <div key={frase.clave} className={`bg-white border rounded-2xl p-4 space-y-3 ${
              frase.estado === 'pendiente' && frase.audio_url ? 'border-amber-200' : 'border-gray-200'
            }`}>

              {/* Header frase */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 capitalize">
                    {frase.clave.replace(/_/g, ' ')}
                  </span>
                </div>
                {/* Métricas */}
                {frase.snr_estimado !== null && (
                  <span className={`text-[10px] font-mono font-bold ${
                    frase.snr_estimado >= 20 ? 'text-emerald-600' :
                    frase.snr_estimado >= 10 ? 'text-amber-500'   : 'text-red-500'
                  }`}>SNR {frase.snr_estimado}dB</span>
                )}
              </div>

              {/* Guion */}
              {frase.guion && (
                <p className="text-[11px] text-gray-500 italic leading-relaxed">
                  &ldquo;{frase.guion}&rdquo;
                </p>
              )}

              {/* Sin audio */}
              {!frase.audio_url && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <FileAudio className="w-3.5 h-3.5" />
                  Sin audio subido
                </p>
              )}

              {/* Reproductor + controles */}
              {frase.signed_url && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePlay(frase)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 transition-colors"
                  >
                    {playing === frase.clave
                      ? <><Pause  className="w-3.5 h-3.5" />Pausar</>
                      : <><Play   className="w-3.5 h-3.5" />Escuchar</>
                    }
                  </button>
                  {frase.duracion_segundos !== null && (
                    <span className="text-[10px] text-gray-400 font-mono">{frase.duracion_segundos}s</span>
                  )}
                </div>
              )}

              {/* Nota admin */}
              {frase.audio_url && (
                <input
                  type="text"
                  value={notas[frase.clave] ?? ''}
                  onChange={e => setNotas(p => ({ ...p, [frase.clave]: e.target.value }))}
                  placeholder="Nota opcional para el socio…"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-gray-300"
                />
              )}

              {/* Botones aprobar / rechazar */}
              {frase.audio_url && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => validarAudio(frase.clave, 'validado')}
                    disabled={busy || frase.estado === 'validado'}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl py-2 transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Aprobar
                  </button>
                  <button
                    onClick={() => validarAudio(frase.clave, 'rechazado')}
                    disabled={busy || frase.estado === 'rechazado'}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-300 rounded-xl py-2 transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Rechazar
                  </button>
                  {frase.estado !== 'pendiente' && (
                    <button
                      onClick={() => validarAudio(frase.clave, 'pendiente')}
                      disabled={busy}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                      title="Volver a pendiente"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
