'use client'

/**
 * AlertaTimbre — Alerta de Timbre en tiempo real
 *
 * Se conecta al SSE /api/dashboard/alertas/stream y muestra una notificación
 * emergente cuando el agente detecta un lead listo para el cierre.
 *
 * Incluye:
 *  - Campana animada con sonido visual
 *  - Datos del lead + resumen del agente
 *  - Botón "Abrir Chat" → link directo a la landing
 *  - Botón "Confirmar" → marca la alerta como procesada
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, X, ExternalLink, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'

interface AlertaCierre {
  evento_id:      string
  prospecto_id:   string
  nombre:         string
  telefono:       string | null
  correo:         string | null
  campana_id:     string | null
  resumen:        string | null
  link_chat:      string
  creado_en:      string
}

interface AlertaTimbreProps {
  habilitado?: boolean  // false si campanaId es null (sin campaña activa)
}

export function AlertaTimbre({ habilitado = true }: AlertaTimbreProps) {
  const [alertas, setAlertas] = useState<AlertaCierre[]>([])
  const [expandida, setExpandida] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconectarRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const conectar = useCallback(() => {
    if (!habilitado) return
    if (esRef.current) { esRef.current.close() }

    const es = new EventSource('/api/dashboard/alertas/stream')
    esRef.current = es

    es.addEventListener('cierre_listo', (e) => {
      try {
        const alerta = JSON.parse(e.data) as AlertaCierre
        setAlertas(prev => {
          if (prev.some(a => a.evento_id === alerta.evento_id)) return prev
          return [alerta, ...prev]
        })
        // Pulso visual: hacer que el título parpadee
        document.title = `🔔 CIERRE — ${alerta.nombre}`
        setTimeout(() => { document.title = document.title.replace('🔔 CIERRE — ', '') }, 4000)
      } catch { /* json malformado */ }
    })

    // Reconectar automáticamente si el stream se cierra (el server lo cierra a los 5min)
    es.addEventListener('error', () => {
      es.close()
      reconectarRef.current = setTimeout(conectar, 3000)
    })
  }, [habilitado])

  useEffect(() => {
    conectar()
    return () => {
      esRef.current?.close()
      if (reconectarRef.current) clearTimeout(reconectarRef.current)
    }
  }, [conectar])

  const acknowledgeAlerta = async (eventoId: string) => {
    await fetch('/api/dashboard/alertas/ack', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ evento_id: eventoId }),
    }).catch(() => {})
    setAlertas(prev => prev.filter(a => a.evento_id !== eventoId))
  }

  if (!alertas.length) return null

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-3 max-w-sm w-full">
      {alertas.map((alerta) => (
        <div
          key={alerta.evento_id}
          className="bg-white border-2 border-orange-400 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-5 duration-300"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-4 py-3 bg-orange-50">
            <div className="relative shrink-0 mt-0.5">
              <Bell className="w-5 h-5 text-orange-500 animate-bounce" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                🔔 Lead listo para cierre
              </p>
              <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">
                {alerta.nombre}
              </p>
            </div>
            <button
              onClick={() => acknowledgeAlerta(alerta.evento_id)}
              className="text-gray-400 hover:text-gray-600 shrink-0 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Datos de contacto */}
          <div className="px-4 py-2 space-y-1">
            {alerta.telefono && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Phone className="w-3 h-3 shrink-0 text-gray-400" />
                <span className="font-mono">{alerta.telefono}</span>
              </div>
            )}
            {alerta.correo && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Mail className="w-3 h-3 shrink-0 text-gray-400" />
                <span className="truncate">{alerta.correo}</span>
              </div>
            )}
          </div>

          {/* Resumen del agente (colapsable) */}
          {alerta.resumen && (
            <div className="px-4 pb-2">
              <button
                onClick={() => setExpandida(v => v === alerta.evento_id ? null : alerta.evento_id)}
                className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 transition-colors"
              >
                {expandida === alerta.evento_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Resumen del agente
              </button>
              {expandida === alerta.evento_id && (
                <p className="mt-1.5 text-[11px] text-gray-600 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100 leading-relaxed">
                  {alerta.resumen}
                </p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="px-4 pb-3 flex gap-2">
            <a
              href={alerta.link_chat}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver conversación
            </a>
            <button
              onClick={() => acknowledgeAlerta(alerta.evento_id)}
              className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
