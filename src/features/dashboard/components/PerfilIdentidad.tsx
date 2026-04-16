'use client'

/**
 * PerfilIdentidad — Motor de Identidad del Socio
 *
 * Permite al socio configurar:
 *  - ID de afiliado (solo lectura — auto-generado)
 *  - Voz clonada (ElevenLabs voice ID)
 *  - Estilo de comunicación del agente
 *  - Tipo de cierre (automático / callcenter)
 *  - URLs de CallCenter / Portal de registro
 *  - Mensaje personalizado de cierre
 */

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, Copy, Check, Mic, UserCircle, Phone, Link, MessageSquare } from 'lucide-react'

type EstiloComunicacion = 'profesional' | 'amigable' | 'motivacional' | 'cercano'
type TipoCierre = 'automatico' | 'callcenter'

interface Perfil {
  voz_clonada_id:       string
  voz_proveedor:        string
  estilo_comunicacion:  EstiloComunicacion
  tipo_cierre:          TipoCierre
  callcenter_url:       string
  callcenter_telefono:  string
  portal_registro_url:  string
  mensaje_cierre_custom: string
}

const ESTILOS: { value: EstiloComunicacion; label: string; desc: string }[] = [
  { value: 'profesional',  label: 'Profesional',  desc: 'Serio, preciso y confiable' },
  { value: 'amigable',     label: 'Amigable',     desc: 'Cálido, cercano y conversacional' },
  { value: 'motivacional', label: 'Motivacional', desc: 'Energético e inspirador' },
  { value: 'cercano',      label: 'Cercano',      desc: 'Como amigo de confianza' },
]

export function PerfilIdentidad() {
  const [idAfiliado, setIdAfiliado]   = useState('')
  const [nombre,     setNombre]       = useState('')
  const [perfil,     setPerfil]       = useState<Partial<Perfil>>({
    estilo_comunicacion: 'profesional',
    tipo_cierre:         'callcenter',
    voz_proveedor:       'elevenlabs',
  })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')
  const [copiado,  setCopiado]  = useState(false)

  useEffect(() => {
    fetch('/api/socio/perfil')
      .then(r => r.json())
      .then(data => {
        setIdAfiliado(data.id_afiliado ?? '')
        setNombre(data.nombre ?? '')
        if (data.perfil) {
          setPerfil({
            voz_clonada_id:       data.perfil.voz_clonada_id       ?? '',
            voz_proveedor:        data.perfil.voz_proveedor        ?? 'elevenlabs',
            estilo_comunicacion:  data.perfil.estilo_comunicacion  ?? 'profesional',
            tipo_cierre:          data.perfil.tipo_cierre          ?? 'callcenter',
            callcenter_url:       data.perfil.callcenter_url       ?? '',
            callcenter_telefono:  data.perfil.callcenter_telefono  ?? '',
            portal_registro_url:  data.perfil.portal_registro_url  ?? '',
            mensaje_cierre_custom:data.perfil.mensaje_cierre_custom ?? '',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/socio/perfil', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(perfil),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al guardar')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  const copiarId = () => {
    navigator.clipboard.writeText(idAfiliado).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  const set = (key: keyof Perfil, val: string) =>
    setPerfil(p => ({ ...p, [key]: val }))

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-lg">

      {/* ─── ID de Afiliado ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <UserCircle className="w-4 h-4 text-blue-500" />
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Tu ID de Afiliado</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 text-lg font-bold text-gray-800 bg-white rounded-xl px-4 py-2.5 border border-blue-100 tracking-widest">
            {idAfiliado || '—'}
          </code>
          <button
            onClick={copiarId}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-white border border-blue-200 rounded-xl px-3 py-2.5 transition-colors"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-[11px] text-blue-500 mt-2">
          Este ID es el que el agente entrega a los leads para registrarse. Nunca lo compartas manualmente — el agente lo gestiona.
        </p>
        <p className="text-xs font-medium text-gray-700 mt-1.5">{nombre}</p>
      </div>

      {/* ─── Estilo de comunicación ──────────────────────────────────── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
          Estilo de comunicación del agente
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ESTILOS.map(e => (
            <button
              key={e.value}
              onClick={() => set('estilo_comunicacion', e.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                perfil.estilo_comunicacion === e.value
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xs font-semibold text-gray-800">{e.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{e.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Voz clonada ─────────────────────────────────────────────── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Mic className="w-3.5 h-3.5 text-emerald-500" />
          ID de Voz Clonada (ElevenLabs)
        </label>
        <input
          type="text"
          value={perfil.voz_clonada_id ?? ''}
          onChange={e => set('voz_clonada_id', e.target.value)}
          placeholder="ej: abc123xyz (de tu dashboard de ElevenLabs)"
          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300 font-mono"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Opcional. Cuando esté disponible la síntesis de voz, el agente usará tu voz clonada en el cierre.
        </p>
      </div>

      {/* ─── Tipo de cierre ──────────────────────────────────────────── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Phone className="w-3.5 h-3.5 text-orange-500" />
          Tipo de cierre
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'callcenter',  label: 'CallCenter',  desc: 'Lead llama + script de voz' },
            { value: 'automatico',  label: 'Automático',  desc: 'Registro online directo' },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => set('tipo_cierre', t.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                perfil.tipo_cierre === t.value
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xs font-semibold text-gray-800">{t.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── URLs y teléfono ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <Link className="w-3.5 h-3.5 text-blue-500" />
          Links de registro
        </label>

        {perfil.tipo_cierre === 'callcenter' && (
          <input
            type="tel"
            value={perfil.callcenter_telefono ?? ''}
            onChange={e => set('callcenter_telefono', e.target.value)}
            placeholder="Teléfono del CallCenter (+506...)"
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
          />
        )}

        <input
          type="text"
          value={perfil.portal_registro_url ?? ''}
          onChange={e => set('portal_registro_url', e.target.value)}
          placeholder="URL del portal de registro"
          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
        />

        <input
          type="text"
          value={perfil.callcenter_url ?? ''}
          onChange={e => set('callcenter_url', e.target.value)}
          placeholder="URL alternativa / link de respaldo"
          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
        />
      </div>

      {/* ─── Mensaje personalizado de cierre ─────────────────────────── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
          Mensaje personalizado de cierre (opcional)
        </label>
        <textarea
          value={perfil.mensaje_cierre_custom ?? ''}
          onChange={e => set('mensaje_cierre_custom', e.target.value)}
          placeholder="Si lo dejas vacío, el agente usará el template por defecto. Puedes personalizarlo aquí..."
          rows={3}
          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300 resize-none"
        />
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 disabled:opacity-50 transition-colors"
      >
        {saving
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando…</>
          : saved
            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />Guardado</>
            : 'Guardar perfil de identidad'
        }
      </button>
    </div>
  )
}
