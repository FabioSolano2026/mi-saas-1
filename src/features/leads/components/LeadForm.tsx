'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, User, Mail, Phone } from 'lucide-react'

interface LeadFormProps {
  socioNombre: string
  campanaId:   string
  refSlug:     string
}

type Estado = 'idle' | 'loading' | 'success' | 'error'

export function LeadForm({ socioNombre, campanaId, refSlug }: LeadFormProps) {
  const [nombre,   setNombre]   = useState('')
  const [email,    setEmail]    = useState('')
  const [telefono, setTelefono] = useState('')
  const [estado,   setEstado]   = useState<Estado>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, email, telefono, ref_slug: refSlug }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al enviar')
      }

      setEstado('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado')
      setEstado('error')
    }
  }

  if (estado === 'success') {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h3 className="text-base font-semibold text-gray-800">
          ¡Listo! {socioNombre} te contactará pronto.
        </h3>
        <p className="text-sm text-gray-400">
          Revisa tu correo para más información.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4"
    >
      <p className="text-sm text-gray-600 text-center">
        Déjanos tus datos y {socioNombre} te contactará.
      </p>

      {/* Nombre */}
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
        <input
          type="text"
          required
          minLength={2}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre completo"
          disabled={estado === 'loading'}
          className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
        />
      </div>

      {/* Email */}
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          disabled={estado === 'loading'}
          className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
        />
      </div>

      {/* Teléfono */}
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
        <input
          type="tel"
          required
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Tu número de teléfono"
          disabled={estado === 'loading'}
          className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
        />
      </div>

      {/* Error */}
      {estado === 'error' && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={estado === 'loading'}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {estado === 'loading'
          ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</>
          : 'Quiero más información'
        }
      </button>
    </form>
  )
}
