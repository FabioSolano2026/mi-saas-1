'use client'

import { useState }         from 'react'
import { useRouter }        from 'next/navigation'
import { Loader2, User, Phone, Briefcase, Camera } from 'lucide-react'
import type { TipoNegocio } from '../services/onboarding.service'

interface OnboardingViewProps {
  tiposNegocio: TipoNegocio[]
  nombreInicial: string
}

export function OnboardingView({ tiposNegocio, nombreInicial }: OnboardingViewProps) {
  const router = useRouter()

  const [nombre,         setNombre]         = useState(nombreInicial)
  const [telefono,       setTelefono]       = useState('')
  const [fotoUrl,        setFotoUrl]        = useState('')
  const [tipoNegocioId,  setTipoNegocioId]  = useState(tiposNegocio[0]?.tipo_negocio_id ?? '')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding/completar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre_completo:  nombre,
          telefono,
          foto_url:         fotoUrl || null,
          tipo_negocio_id:  tipoNegocioId,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al guardar')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">¡Bienvenido!</h1>
          <p className="text-sm text-gray-500 mt-2">
            Completa tu perfil para acceder a tu Dashboard
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5"
        >
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Nombre completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                type="text"
                required
                minLength={2}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre completo"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Teléfono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+506 8888-8888"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* Foto URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              URL de tu foto <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="relative">
              <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                type="url"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://..."
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all"
              />
            </div>
            {fotoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={fotoUrl}
                  alt="Preview"
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs text-gray-400">Preview</span>
              </div>
            )}
          </div>

          {/* Tipo de negocio */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Tipo de negocio
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <select
                required
                value={tipoNegocioId}
                onChange={(e) => setTipoNegocioId(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-all appearance-none"
              >
                <option value="" disabled>Selecciona tu nicho</option>
                {tiposNegocio.map((t) => (
                  <option key={t.tipo_negocio_id} value={t.tipo_negocio_id}>
                    {t.icono} {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            {tiposNegocio.find(t => t.tipo_negocio_id === tipoNegocioId)?.descripcion && (
              <p className="text-xs text-gray-400 mt-1.5 pl-1">
                {tiposNegocio.find(t => t.tipo_negocio_id === tipoNegocioId)?.descripcion}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 text-center bg-red-50 border border-red-100 rounded-xl py-2.5 px-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !tipoNegocioId}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
              : 'Completar perfil y continuar →'
            }
          </button>
        </form>

      </div>
    </div>
  )
}
