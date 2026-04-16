'use client'

import { useState, useEffect, useCallback } from 'react'
import { getProspectos } from '../services/kanban.service'
import type { TableroKanban } from '../types/kanban.types'

interface UseKanbanReturn {
  tablero: TableroKanban | null
  loading: boolean
  error: string | null
  recargar: () => void
}

export function useKanban(): UseKanbanReturn {
  const [tablero, setTablero] = useState<TableroKanban | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await getProspectos()

    if (result.error) {
      setError(result.error)
      setTablero(null)
    } else {
      setTablero(result.data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { tablero, loading, error, recargar: cargar }
}
