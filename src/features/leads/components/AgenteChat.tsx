'use client'

/**
 * AgenteChat.tsx
 *
 * Chat conversacional que implementa los 5 Momentos de MISION_AGENTE.md:
 *  M1  — Hook de entrada (auto-dispara a los 5s sin input del usuario)
 *  M2  — 3 preguntas de filtro secuenciales
 *  M3  — Entrega de recomendación personalizada
 *  M4  — Rescate del prospecto frío (exit-intent)
 *  M5a — Prueba social dinámica
 *  M5b — Pregunta de bifurcación (producto → negocio)
 *  M6  — Potencial financiero
 *  M7  — Cierre de reclutamiento y afiliación
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2 }                            from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Mensaje {
  role:    'user' | 'assistant'
  content: string
}

interface AgenteChatProps {
  campanaId:   string
  socioNombre: string
  refSlug:     string
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AgenteChat({ campanaId, socioNombre, refSlug }: AgenteChatProps) {
  const [mensajes,     setMensajes]     = useState<Mensaje[]>([])
  const [input,        setInput]        = useState('')
  const [cargando,     setCargando]     = useState(false)
  const [prospectoId,  setProspectoId]  = useState<string | null>(null)
  const [exitIntent,   setExitIntent]   = useState(false)
  const [datosCaptura, setDatosCaptura] = useState<{nombre?:string;email?:string;telefono?:string}>({})

  const scrollRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const m1Disparado  = useRef(false)
  const m4Disparado  = useRef(false)

  // ─── Scroll automático al último mensaje ──────────────────────────────────

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // ─── Recuperar prospecto_id de sessionStorage ──────────────────────────────

  useEffect(() => {
    const stored = sessionStorage.getItem(`pid_${campanaId}`)
    if (stored) setProspectoId(stored)
  }, [campanaId])

  // ─── M1: Hook de entrada — auto-dispara a los 5s ──────────────────────────

  useEffect(() => {
    if (m1Disparado.current) return
    const t = setTimeout(() => {
      if (m1Disparado.current) return
      m1Disparado.current = true
      enviarAlAgente([], null)   // mensajes vacíos → backend detecta M1
    }, 5000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── M4: Exit-intent — detecta intención de salir ─────────────────────────

  useEffect(() => {
    function handleExitIntent(e: MouseEvent) {
      // Cursor saliendo por la parte superior de la ventana
      if (e.clientY < 20 && !m4Disparado.current && mensajes.length > 0 && mensajes.length < 6) {
        m4Disparado.current = true
        setExitIntent(true)
      }
    }
    document.addEventListener('mouseleave', handleExitIntent)
    return () => document.removeEventListener('mouseleave', handleExitIntent)
  }, [mensajes.length])

  // ─── Enviar mensaje al agente con streaming ────────────────────────────────

  const enviarAlAgente = useCallback(async (
    historial: Mensaje[],
    idProspecto: string | null,
    datosExtras?: { nombre?: string; email?: string; telefono?: string },
  ) => {
    setCargando(true)

    // Añadir placeholder del asistente que se irá llenando con el stream
    let textoAsistente = ''
    setMensajes(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/agente', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          campana_id:   campanaId,
          messages:     historial,
          prospecto_id: idProspecto ?? undefined,
          prospecto:    datosExtras ?? datosCaptura,
        }),
      })

      if (!res.ok) throw new Error('Error del agente')

      // Capturar prospecto_id del header
      const pidHeader = res.headers.get('X-Prospecto-Id')
      if (pidHeader && !idProspecto) {
        setProspectoId(pidHeader)
        sessionStorage.setItem(`pid_${campanaId}`, pidHeader)
      }

      // Leer stream
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        textoAsistente += decoder.decode(value, { stream: true })
        // Actualizar el último mensaje (placeholder) con el texto acumulado
        setMensajes(prev => {
          const copia = [...prev]
          copia[copia.length - 1] = { role: 'assistant', content: textoAsistente }
          return copia
        })
      }

    } catch {
      setMensajes(prev => {
        const copia = [...prev]
        copia[copia.length - 1] = {
          role:    'assistant',
          content: 'Lo siento, hubo un problema de conexión. Por favor, intenta de nuevo.',
        }
        return copia
      })
    } finally {
      setCargando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [campanaId, datosCaptura])

  // ─── Manejar envío del usuario ─────────────────────────────────────────────

  const handleEnviar = useCallback(async () => {
    const texto = input.trim()
    if (!texto || cargando) return

    const nuevoMensaje: Mensaje = { role: 'user', content: texto }
    const historialActualizado  = [...mensajes, nuevoMensaje]

    setInput('')
    setMensajes(historialActualizado)

    // Extraer datos del prospecto si los menciona
    const extraccion = extraerDatos(texto)
    if (extraccion) setDatosCaptura(prev => ({ ...prev, ...extraccion }))

    await enviarAlAgente(historialActualizado, prospectoId, extraccion ?? undefined)
  }, [input, cargando, mensajes, prospectoId, enviarAlAgente])

  // ─── Manejar rescate exit-intent (M4) ─────────────────────────────────────

  const handleExitRescate = useCallback(async (acepta: boolean) => {
    setExitIntent(false)
    const respuesta: Mensaje = {
      role:    'user',
      content: acepta ? 'Sí, quiero el descuento y hablar con un asesor por WhatsApp' : 'No gracias',
    }
    const historial = [...mensajes, respuesta]
    setMensajes(historial)
    await enviarAlAgente(historial, prospectoId)
  }, [mensajes, prospectoId, enviarAlAgente])

  // ─── Enter para enviar, Shift+Enter para nueva línea ──────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-[600px] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

      {/* Header del chat */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
          {socioNombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none truncate">Asistente de {socioNombre}</p>
          <p className="text-xs text-emerald-100 mt-0.5">
            {cargando ? 'Escribiendo…' : 'En línea'}
          </p>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">

        {/* Estado inicial — esperando el hook M1 */}
        {mensajes.length === 0 && !cargando && (
          <div className="flex justify-center pt-8">
            <p className="text-xs text-gray-400 animate-pulse">Conectando con el asistente…</p>
          </div>
        )}

        {mensajes.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }
              `}
            >
              {msg.content || (
                <span className="flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje…"
            rows={1}
            disabled={cargando || mensajes.length === 0}
            className="
              flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2
              text-sm text-gray-800 placeholder-gray-400 bg-gray-50
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
              disabled:opacity-50 max-h-32
            "
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleEnviar}
            disabled={!input.trim() || cargando}
            className="
              w-9 h-9 flex-shrink-0 flex items-center justify-center
              bg-emerald-600 text-white rounded-xl
              hover:bg-emerald-700 active:scale-95 transition
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            {cargando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">
          Información compartida por {socioNombre} · Ref: {refSlug}
        </p>
      </div>

      {/* Overlay M4 — Exit Intent Rescue */}
      {exitIntent && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-10">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-center">
            <div className="text-3xl">⏳</div>
            <h3 className="text-base font-bold text-gray-900 leading-snug">
              ¡Espera! No te vayas sin este beneficio
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{socioNombre}</strong> me autorizó a darte un{' '}
              <span className="text-emerald-600 font-bold">CUPÓN VIP del 30% de descuento</span>{' '}
              si inicias hoy mismo.
            </p>
            <p className="text-sm text-gray-700 font-medium">
              ¿Prefieres que un asesor real te contacte por WhatsApp para aplicar tu descuento?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleExitRescate(true)}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
              >
                Sí, quiero mi descuento
              </button>
              <button
                onClick={() => handleExitRescate(false)}
                className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition"
              >
                No gracias
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Extracción simple de datos del prospecto desde texto libre ───────────────

function extraerDatos(texto: string): { nombre?: string; email?: string; telefono?: string } | null {
  const resultado: { nombre?: string; email?: string; telefono?: string } = {}

  const emailMatch = texto.match(/[\w.-]+@[\w.-]+\.\w{2,}/)
  if (emailMatch) resultado.email = emailMatch[0]

  const telefonoMatch = texto.match(/(\+?[\d\s\-().]{8,15})/)
  if (telefonoMatch) resultado.telefono = telefonoMatch[0].trim()

  return Object.keys(resultado).length > 0 ? resultado : null
}
