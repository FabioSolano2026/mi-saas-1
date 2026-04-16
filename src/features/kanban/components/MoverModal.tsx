'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMoverProspecto } from '../hooks/useMoverProspecto'
import { COLUMNAS_KANBAN } from '../types/kanban.types'
import type { Prospecto, ColumnaKanban } from '../types/kanban.types'

// Etiquetas legibles para el usuario
const ETIQUETAS: Record<ColumnaKanban, string> = {
  nuevo_prospecto:   'Nuevo prospecto',
  contactado:        'Contactado',
  en_seguimiento:    'En seguimiento',
  propuesta_enviada: 'Propuesta enviada',
  listo_para_cerrar: 'Listo para cerrar',
  cliente_activo:    'Cliente activo',
  no_interesado:     'No interesado',
  sin_respuesta:     'Sin respuesta',
  reagendar:         'Reagendar',
}

interface MoverModalProps {
  prospecto: Prospecto | null
  abierto: boolean
  onCerrar: () => void
  onExito: () => void
}

export function MoverModal({ prospecto, abierto, onCerrar, onExito }: MoverModalProps) {
  const [destino, setDestino] = useState<ColumnaKanban | ''>('')
  const [nota, setNota] = useState('')

  const { mover, moviendo, error } = useMoverProspecto(() => {
    onExito()
    onCerrar()
    setDestino('')
    setNota('')
  })

  const handleMover = async () => {
    if (!prospecto || !destino) return
    await mover(prospecto.prospecto_id, destino, nota || undefined)
  }

  const columnaActual = prospecto?.columna_kanban as ColumnaKanban | undefined

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Mover prospecto
          </DialogTitle>
          {prospecto && (
            <p className="text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{prospecto.nombre ?? 'Sin nombre'}</span>
              {' '}· actualmente en{' '}
              <span className="font-medium">{columnaActual ? ETIQUETAS[columnaActual] : '—'}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de columna destino */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Mover a</label>
            <Select
              value={destino}
              onValueChange={(val) => setDestino(val as ColumnaKanban)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una columna..." />
              </SelectTrigger>
              <SelectContent>
                {COLUMNAS_KANBAN.filter((col) => col !== columnaActual).map((col) => (
                  <SelectItem key={col} value={col}>
                    {ETIQUETAS[col]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nota opcional — queda en movimientos_kanban (audit trail) */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">
              Nota <span className="text-neutral-400 font-normal">(opcional)</span>
            </label>
            <Textarea
              placeholder="Ej: Cliente solicitó más información sobre el producto..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Error del servidor */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar} disabled={moviendo}>
            Cancelar
          </Button>
          <Button
            onClick={handleMover}
            disabled={!destino || moviendo}
          >
            {moviendo ? 'Moviendo...' : 'Confirmar movimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
