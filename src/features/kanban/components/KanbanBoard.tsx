'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useKanban } from '../hooks/useKanban'
import { KanbanColumn } from './KanbanColumn'
import { MoverModal } from './MoverModal'
import { contarProspectosActivos } from '../services/kanban.service'
import { COLUMNAS_KANBAN } from '../types/kanban.types'
import type { Prospecto } from '../types/kanban.types'

// ─────────────────────────────────────────────────────────────
// Estado: Loading
// ─────────────────────────────────────────────────────────────
function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="min-w-[220px] w-[220px] h-64 bg-neutral-100 rounded-lg border border-neutral-200 animate-pulse"
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Estado: Error
// Muestra mensaje amigable. Si es 401/403 lo indica claramente.
// ─────────────────────────────────────────────────────────────
function KanbanError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const esSesion =
    mensaje.toLowerCase().includes('sesión') || mensaje.toLowerCase().includes('sesion')

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-sm w-full">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-700 mb-1">
          {esSesion ? 'Tu sesión ha expirado' : 'No se pudo cargar el tablero'}
        </p>
        <p className="text-xs text-red-500 mb-4">{mensaje}</p>
        {esSesion ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => (window.location.href = '/login')}
          >
            Iniciar sesión
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Reintentar
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KanbanBoard — componente principal
// ─────────────────────────────────────────────────────────────
export function KanbanBoard() {
  const { tablero, loading, error, recargar } = useKanban()

  // Estado del modal de movimiento
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState<Prospecto | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  const abrirModal = (prospecto: Prospecto) => {
    setProspectoSeleccionado(prospecto)
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setProspectoSeleccionado(null)
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando tablero...
        </div>
        <KanbanSkeleton />
      </div>
    )
  }

  // ── Error boundary ──
  if (error) {
    return <KanbanError mensaje={error} onReintentar={recargar} />
  }

  // ── Sin datos ──
  if (!tablero) return null

  const totalActivos = contarProspectosActivos(tablero)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-800">Tablero Kanban</h2>
          <p className="text-sm text-neutral-500">
            {totalActivos} prospecto{totalActivos !== 1 ? 's' : ''} activo{totalActivos !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={recargar}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* Tablero horizontal con scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNAS_KANBAN.map((columna) => (
          <KanbanColumn
            key={columna}
            columna={columna}
            prospectos={tablero[columna]}
            onMover={abrirModal}
          />
        ))}
      </div>

      {/* Modal de movimiento */}
      <MoverModal
        prospecto={prospectoSeleccionado}
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        onExito={recargar}
      />
    </div>
  )
}
