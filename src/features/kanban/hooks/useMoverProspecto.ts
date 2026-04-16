'use client'

import { useState } from 'react'
import { moverProspecto } from '../services/kanban.service'
import type { ColumnaKanban } from '../types/kanban.types'

interface UseMoverProspectoReturn {
  mover: (prospecto_id: string, destino: ColumnaKanban, nota?: string) => Promise<boolean>
  moviendo: boolean
  error: string | null
}

export function useMoverProspecto(onExito?: () => void): UseMoverProspectoReturn {
  const [moviendo, setMoviendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mover = async (
    prospecto_id: string,
    destino: ColumnaKanban,
    nota?: string
  ): Promise<boolean> => {
    setMoviendo(true)
    setError(null)

    const result = await moverProspecto({ prospecto_id, destino, nota })

    setMoviendo(false)

    if (result.error) {
      setError(result.error)
      return false
    }

    onExito?.()
    return true
  }

  return { mover, moviendo, error }
}
