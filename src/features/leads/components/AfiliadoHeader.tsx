import Image from 'next/image'
import { UserCircle2 } from 'lucide-react'
import type { AfiliadoContexto } from '../types/lead.types'

interface AfiliadoHeaderProps {
  contexto: AfiliadoContexto
}

export function AfiliadoHeader({ contexto }: AfiliadoHeaderProps) {
  const { nombre_socio, foto_socio, descripcion_campana, campana_nombre, multimedia_url } = contexto

  return (
    <header className="w-full bg-white border-b border-gray-100">

      {/* Banner multimedia (video/imagen de la campaña) */}
      {multimedia_url && (
        <div className="w-full aspect-video max-h-64 overflow-hidden bg-gray-900">
          {multimedia_url.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={multimedia_url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={multimedia_url}
              alt={campana_nombre}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Datos del socio */}
      <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-4">

        {/* Foto del socio — responsive */}
        <div className="shrink-0">
          {foto_socio ? (
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-white shadow-md">
              <Image
                src={foto_socio}
                alt={nombre_socio}
                fill
                sizes="(max-width: 640px) 56px, 64px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-100 flex items-center justify-center ring-2 ring-white shadow-md">
              <UserCircle2 className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Nombre y descripción */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
            Te recomienda
          </p>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
            {nombre_socio}
          </h1>
          {descripcion_campana && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">
              {descripcion_campana}
            </p>
          )}
        </div>

      </div>
    </header>
  )
}
