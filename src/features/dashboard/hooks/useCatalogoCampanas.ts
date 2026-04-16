'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CampanaConEstado }            from '../types/dashboard.types'

export function useCatalogoCampanas() {
  const [campanas,  setCampanas]  = useState<CampanaConEstado[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [toggling,  setToggling]  = useState<string | null>(null) // campana_id en proceso

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/campanas')
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al cargar campañas')
      setCampanas(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const toggleCampana = async (campana_id: string) => {
    setToggling(campana_id)
    try {
      const res = await fetch('/api/dashboard/campanas/toggle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campana_id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { estado } = await res.json()
      setCampanas(prev => prev.map(c =>
        c.campana_id === campana_id ? { ...c, estado_socio: estado } : c
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado')
    } finally {
      setToggling(null)
    }
  }

  return { campanas, loading, error, toggleCampana, toggling, recargar: cargar }
}
