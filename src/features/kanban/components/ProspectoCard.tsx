'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ThermometerSun, Clock, ArrowRight } from 'lucide-react'
import type { Prospecto } from '../types/kanban.types'

interface ProspectoCardProps {
  prospecto: Prospecto
  onMover: (prospecto: Prospecto) => void
}

// Temperatura → color del badge (solo lectura — la calcula el agente)
const TEMPERATURA_ESTILOS: Record<string, string> = {
  caliente: 'bg-red-100 text-red-700 border-red-200',
  tibio:    'bg-amber-100 text-amber-700 border-amber-200',
  frio:     'bg-blue-100 text-blue-700 border-blue-200',
}

// Días sin contacto → alerta visual
function alertaDias(dias: number): string {
  if (dias >= 3) return 'text-red-500 font-semibold'
  if (dias >= 1) return 'text-amber-500'
  return 'text-gray-400'
}

export function ProspectoCard({ prospecto, onMover }: ProspectoCardProps) {
  const tempEstilo = TEMPERATURA_ESTILOS[prospecto.temperatura] ?? 'bg-gray-100 text-gray-600'

  return (
    <Card className="mb-2 cursor-default shadow-sm hover:shadow-md transition-shadow border border-neutral-200">
      <CardContent className="p-3 space-y-2">

        {/* Nombre + temperatura (solo lectura) */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-neutral-800 leading-tight">
            {prospecto.nombre ?? 'Sin nombre'}
          </p>
          <Badge className={`text-xs shrink-0 border ${tempEstilo}`} variant="outline">
            <ThermometerSun className="w-3 h-3 mr-1" />
            {prospecto.temperatura}
          </Badge>
        </div>

        {/* Contacto */}
        {(prospecto.correo || prospecto.telefono) && (
          <p className="text-xs text-neutral-500 truncate">
            {prospecto.correo ?? prospecto.telefono}
          </p>
        )}

        {/* Días sin contacto — alerta si >= 3 (riesgo) */}
        <div className={`flex items-center gap-1 text-xs ${alertaDias(prospecto.dias_sin_contacto)}`}>
          <Clock className="w-3 h-3" />
          {prospecto.dias_sin_contacto === 0
            ? 'Contactado hoy'
            : `${prospecto.dias_sin_contacto} día${prospecto.dias_sin_contacto !== 1 ? 's' : ''} sin contacto`}
        </div>

        {/* Botón mover — el socio_id lo valida el servidor, no el cliente */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
          onClick={() => onMover(prospecto)}
        >
          <ArrowRight className="w-3 h-3 mr-1" />
          Mover
        </Button>
      </CardContent>
    </Card>
  )
}
