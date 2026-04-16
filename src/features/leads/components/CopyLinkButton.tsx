'use client'

import { Copy, Check, ExternalLink } from 'lucide-react'
import { useCopyLink } from '../hooks/useCopyLink'

interface CopyLinkButtonProps {
  idCorto:     string
  campaNombre: string
  className?:  string
}

export function CopyLinkButton({ idCorto, campaNombre, className = '' }: CopyLinkButtonProps) {
  const { copied, copyLink } = useCopyLink()
  const path = `/c/${idCorto}`
  const url  = typeof window !== 'undefined'
    ? `${window.location.origin}${path}`
    : path

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Vista previa */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500 truncate flex-1 font-mono">{url}</span>
      </div>

      {/* Botón copiar */}
      <button
        onClick={() => copyLink(idCorto)}
        className={`
          flex items-center justify-center gap-2 w-full
          text-xs font-medium py-2.5 px-4 rounded-xl
          transition-all duration-200 cursor-pointer border
          ${copied
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }
        `}
      >
        {copied
          ? <><Check className="w-3.5 h-3.5" />Link copiado</>
          : <><Copy  className="w-3.5 h-3.5" />Copiar link de {campaNombre}</>
        }
      </button>
    </div>
  )
}
