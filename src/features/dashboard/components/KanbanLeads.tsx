'use client'

import { useState }             from 'react'
import { Loader2, AlertCircle, User, Phone, Mail, ChevronDown, MessageCircle } from 'lucide-react'
import { useKanbanLeads }       from '../hooks/useKanbanLeads'
import {
  COLUMNAS, COLUMNA_LABEL, TEMPERATURA_COLOR,
  type ColumnaKanban, type LeadResumen,
} from '../types/dashboard.types'

// ─── Tarjeta de lead ──────────────────────────────────────────────────────────

function LeadCard({
  lead, onMover, moviendo,
}: {
  lead: LeadResumen
  onMover: (id: string, destino: ColumnaKanban, nota?: string) => void
  moviendo: boolean
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-2">
      {/* Nombre + temperatura */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="text-xs font-medium text-gray-800 truncate">{lead.nombre}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TEMPERATURA_COLOR[lead.temperatura] ?? 'bg-gray-100 text-gray-500'}`}>
          {lead.temperatura}
        </span>
      </div>

      {/* Contacto */}
      <div className="space-y-0.5 pl-9">
        {lead.telefono && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Phone className="w-3 h-3 shrink-0" />{lead.telefono}
          </p>
        )}
        {lead.correo && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400 truncate">
            <Mail className="w-3 h-3 shrink-0" />{lead.correo}
          </p>
        )}
      </div>

      {/* Días sin contacto + WhatsApp */}
      <div className="pl-9 flex items-center gap-3">
        {lead.dias_sin_contacto > 0 && (
          <p className="text-[10px] text-amber-500 font-medium">
            {lead.dias_sin_contacto}d sin contacto
          </p>
        )}
        {lead.telefono && (
          <a
            href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 transition-colors"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </a>
        )}
      </div>

      {/* Selector de columna destino */}
      <div className="pl-9 pt-1">
        <button
          onClick={() => setAbierto(!abierto)}
          disabled={moviendo}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
        >
          Mover a…
          <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>

        {abierto && (
          <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10 relative">
            {COLUMNAS.filter(c => c !== lead.columna_kanban).map((col) => (
              <button
                key={col}
                onClick={() => { onMover(lead.prospecto_id, col); setAbierto(false) }}
                disabled={moviendo}
                className="w-full text-left text-[11px] px-3 py-2 hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition-colors"
              >
                {COLUMNA_LABEL[col]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Columna del Kanban ───────────────────────────────────────────────────────

function KanbanColumna({
  columna, leads, onMover, moviendo,
}: {
  columna: ColumnaKanban
  leads:   LeadResumen[]
  onMover: (id: string, destino: ColumnaKanban, nota?: string) => void
  moviendo: string | null
}) {
  const colores: Record<string, string> = {
    nuevo_prospecto:  'border-t-blue-400',
    contactado:       'border-t-cyan-400',
    calificado:       'border-t-violet-400',
    interesado:       'border-t-amber-400',
    propuesta_enviada:'border-t-orange-400',
    negociacion:      'border-t-pink-400',
    cliente_activo:   'border-t-emerald-400',
    perdido:          'border-t-red-300',
    descartado:       'border-t-gray-300',
  }

  return (
    <div className={`shrink-0 w-56 bg-gray-50 border border-gray-200 border-t-4 ${colores[columna]} rounded-xl flex flex-col`}>
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest">
          {COLUMNA_LABEL[columna]}
        </span>
        <span className="text-[11px] font-bold text-gray-400 tabular-nums">{leads.length}</span>
      </div>

      {/* Leads */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2 max-h-[calc(100vh-280px)]">
        {leads.length === 0 ? (
          <p className="text-[11px] text-gray-300 text-center py-4">Sin leads</p>
        ) : (
          leads.map(lead => (
            <LeadCard
              key={lead.prospecto_id}
              lead={lead}
              onMover={onMover}
              moviendo={moviendo === lead.prospecto_id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── KanbanLeads (principal) ──────────────────────────────────────────────────

interface KanbanLeadsProps {
  campanaId:     string | null
  campanaNombre: string
}

export function KanbanLeads({ campanaId, campanaNombre }: KanbanLeadsProps) {
  const { porColumna, loading, error, moverLead, moviendo } = useKanbanLeads(campanaId)

  if (!campanaId) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Selecciona una campaña activa para ver sus leads.</p>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center gap-2 h-64 justify-center">
      <AlertCircle className="w-5 h-5 text-red-400" />
      <p className="text-xs text-red-500">{error}</p>
    </div>
  )

  const totalLeads = Object.values(porColumna).reduce((s, l) => s + l.length, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Leads — {campanaNombre}
        </h2>
        <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full tabular-nums">
          {totalLeads} total
        </span>
      </div>

      {/* Tablero horizontal con scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {COLUMNAS.map((col) => (
            <KanbanColumna
              key={col}
              columna={col}
              leads={porColumna[col] ?? []}
              onMover={moverLead}
              moviendo={moviendo}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
