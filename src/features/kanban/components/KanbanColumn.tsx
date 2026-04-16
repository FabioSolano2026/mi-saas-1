'use client'

import { ProspectoCard } from './ProspectoCard'
import type { Prospecto, ColumnaKanban } from '../types/kanban.types'

// Etiquetas y colores por columna
const CONFIG_COLUMNA: Record<ColumnaKanban, { label: string; color: string }> = {
  nuevo_prospecto:   { label: 'Nuevo prospecto',   color: 'border-t-neutral-400' },
  contactado:        { label: 'Contactado',         color: 'border-t-blue-400' },
  en_seguimiento:    { label: 'En seguimiento',     color: 'border-t-indigo-400' },
  propuesta_enviada: { label: 'Propuesta enviada',  color: 'border-t-amber-400' },
  listo_para_cerrar: { label: 'Listo para cerrar',  color: 'border-t-green-400' },
  cliente_activo:    { label: 'Cliente activo',     color: 'border-t-green-600' },
  no_interesado:     { label: 'No interesado',      color: 'border-t-red-400' },
  sin_respuesta:     { label: 'Sin respuesta',      color: 'border-t-orange-400' },
  reagendar:         { label: 'Reagendar',          color: 'border-t-violet-400' },
}

interface KanbanColumnProps {
  columna: ColumnaKanban
  prospectos: Prospecto[]
  onMover: (prospecto: Prospecto) => void
}

export function KanbanColumn({ columna, prospectos, onMover }: KanbanColumnProps) {
  const { label, color } = CONFIG_COLUMNA[columna]

  return (
    <div className={`flex flex-col bg-neutral-50 rounded-lg border border-neutral-200 border-t-4 ${color} min-w-[220px] w-[220px] shrink-0`}>
      {/* Header de columna */}
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs font-bold text-neutral-500 bg-neutral-200 rounded-full px-2 py-0.5">
          {prospectos.length}
        </span>
      </div>

      {/* Tarjetas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0 max-h-[calc(100vh-220px)]">
        {prospectos.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center pt-6">Sin prospectos</p>
        ) : (
          prospectos.map((p) => (
            <ProspectoCard key={p.prospecto_id} prospecto={p} onMover={onMover} />
          ))
        )}
      </div>
    </div>
  )
}
