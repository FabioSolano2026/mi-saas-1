'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LeadResumen, ColumnaKanban }  from '../types/dashboard.types'

export function useKanbanLeads(campanaId: string | null) {
  const [leads,     setLeads]     = useState<LeadResumen[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [moviendo,  setMoviendo]  = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!campanaId) { setLeads([]); return }
    setLoading(true)
    setError(null)
    try {
      const url = `/api/dashboard/leads?campana_id=${campanaId}&page_size=100`
      const res = await fetch(url)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al cargar leads')
      const { leads: data } = await res.json()
      setLeads(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [campanaId])

  useEffect(() => { cargar() }, [cargar])

  const moverLead = async (prospecto_id: string, destino: ColumnaKanban, nota?: string) => {
    setMoviendo(prospecto_id)
    try {
      const res = await fetch('/api/dashboard/leads/mover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prospecto_id, destino, nota }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setLeads(prev => prev.map(l =>
        l.prospecto_id === prospecto_id ? { ...l, columna_kanban: destino } : l
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al mover lead')
    } finally {
      setMoviendo(null)
    }
  }

  // Agrupar por columna para el tablero
  const porColumna = leads.reduce<Record<string, LeadResumen[]>>((acc, lead) => {
    const col = lead.columna_kanban
    if (!acc[col]) acc[col] = []
    acc[col].push(lead)
    return acc
  }, {})

  return { leads, porColumna, loading, error, moverLead, moviendo, recargar: cargar }
}
