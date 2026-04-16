'use client'

/**
 * BotonSuplantar — Botón reutilizable para auditar la sesión de un socio.
 *
 * Llama a POST /api/admin/suplantar/[socioId], guarda la sesión admin
 * en localStorage y redirige al /dashboard viendo como el socio.
 *
 * Props:
 *   socioId    — UUID del socio a suplantar
 *   socioNombre— Nombre para mostrar en el banner de auditoría
 *   variant    — 'icon' (solo ícono) | 'full' (ícono + texto)
 *   onError    — callback opcional para errores (muestra el mensaje externamente)
 */

import { useState }          from 'react'
import { Eye, Loader2 }      from 'lucide-react'
import { iniciarSuplantacion } from '@/features/dashboard/components/BannerAuditoria'

interface Props {
  socioId:     string
  socioNombre: string
  variant?:    'icon' | 'full'
  onError?:    (msg: string) => void
  className?:  string
}

export function BotonSuplantar({
  socioId,
  variant   = 'full',
  onError,
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return

    setLoading(true)
    try {
      await iniciarSuplantacion(socioId)
      // La navegación ocurre dentro de iniciarSuplantacion
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error iniciando auditoría'
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Auditar sesión de este socio"
      className={[
        'inline-flex items-center gap-1.5 text-[11px] font-semibold',
        'text-violet-700 bg-violet-50 border border-violet-200',
        'hover:bg-violet-100 active:bg-violet-200',
        'rounded-lg px-2.5 py-1.5 transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Eye     className="w-3.5 h-3.5" />
      }
      {variant === 'full' && (loading ? 'Iniciando…' : 'Auditar')}
    </button>
  )
}
