'use client'

/**
 * LiveFlowWidget — Kanban Ghost de Actividad en Tiempo Real
 *
 * Visualiza el flujo de prospectos a través del sistema de forma
 * animada y minimalista. Dos modos según NEXT_PUBLIC_ACTIVITY_MODE:
 *
 * 'simulated' → strings predefinidos + intervalos aleatorios (sin BD)
 * 'real'      → GET /api/admin/actividad-global (solo conteos, NUNCA PII)
 *
 * Privacidad blindada:
 *  - Modo real: solo conteos agregados y ubicaciones a nivel de país
 *  - Modo simulado: strings de marketing completamente genéricos
 *  - Ningún modo accede, muestra ni infiere datos personales
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence }                   from 'framer-motion'
import { Activity, Users, Zap }                      from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Columna = 'iniciando' | 'cualificando' | 'procesado'

interface Tarjeta {
  id:       string
  columna:  Columna
  texto:    string
  entrada:  number  // timestamp para ordenar
}

interface ActividadReal {
  conteos: { iniciando: number; cualificando: number; procesados: number }
  total_socios_activos: number
  actividad_reciente:  Array<{ tipo: string; ubicacion: string; hace: string }>
}

// ─── Datos simulados ──────────────────────────────────────────────────────────

const TEXTOS_SIMULADOS: Record<Columna, string[]> = {
  iniciando: [
    'Usuario de México inicia evaluación',
    'Usuario de Colombia inicia evaluación',
    'Usuario de Costa Rica inicia evaluación',
    'Usuario de Perú inicia evaluación',
    'Usuario de Argentina inicia evaluación',
    'Usuario de Chile inicia evaluación',
    'Usuario de Ecuador inicia evaluación',
    'Usuario de Guatemala inicia evaluación',
  ],
  cualificando: [
    'Análisis de salud completado',
    'Perfil de salud generado',
    'Evaluación de necesidades lista',
    'Criterios verificados',
    'Calificación en proceso',
    'Preguntas de filtro respondidas',
  ],
  procesado: [
    'Plan personalizado generado',
    'Pack recomendado con éxito',
    'Proceso completado',
    'Evaluación finalizada',
    'Recomendación entregada',
    'Usuario calificado exitosamente',
  ],
}

const COLUMNAS: { id: Columna; label: string; color: string; dot: string }[] = [
  { id: 'iniciando',    label: 'Iniciando',    color: 'border-blue-100   bg-blue-50/50',   dot: 'bg-blue-400'    },
  { id: 'cualificando', label: 'Cualificando', color: 'border-amber-100  bg-amber-50/50',  dot: 'bg-amber-400'   },
  { id: 'procesado',    label: 'Procesado',    color: 'border-emerald-100 bg-emerald-50/50', dot: 'bg-emerald-400' },
]

const COLUMNA_SECUENCIA: Columna[] = ['iniciando', 'cualificando', 'procesado']

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function textoAleatorio(columna: Columna) {
  const arr = TEXTOS_SIMULADOS[columna]
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Modo simulado ────────────────────────────────────────────────────────────

function useModoSimulado() {
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tick = useCallback(() => {
    setTarjetas(prev => {
      // 1. Avanzar una tarjeta aleatoria a la siguiente columna
      const avanzables = prev.filter(t => t.columna !== 'procesado')
      if (avanzables.length > 0 && Math.random() > 0.3) {
        const idx    = Math.floor(Math.random() * avanzables.length)
        const target = avanzables[idx]
        const sig    = COLUMNA_SECUENCIA[COLUMNA_SECUENCIA.indexOf(target.columna) + 1]
        const next   = prev.map(t =>
          t.id === target.id ? { ...t, columna: sig, texto: textoAleatorio(sig) } : t,
        )
        // 2. Eliminar "procesadas" viejas (max 2 por columna)
        const procesadas = next.filter(t => t.columna === 'procesado')
        if (procesadas.length > 2) {
          const masVieja = procesadas.sort((a, b) => a.entrada - b.entrada)[0]
          return next.filter(t => t.id !== masVieja.id)
        }
        return next
      }

      // 3. Añadir nueva tarjeta en "iniciando" (max 3 por columna)
      const enIniciando = prev.filter(t => t.columna === 'iniciando')
      if (enIniciando.length < 3) {
        return [...prev, {
          id:      uid(),
          columna: 'iniciando',
          texto:   textoAleatorio('iniciando'),
          entrada: Date.now(),
        }]
      }

      return prev
    })

    // Intervalo aleatorio 1.8s – 4.5s
    const delay = 1_800 + Math.random() * 2_700
    timerRef.current = setTimeout(tick, delay)
  }, [])

  useEffect(() => {
    // Semilla inicial
    setTarjetas([
      { id: uid(), columna: 'iniciando',    texto: textoAleatorio('iniciando'),    entrada: Date.now() },
      { id: uid(), columna: 'cualificando', texto: textoAleatorio('cualificando'), entrada: Date.now() },
      { id: uid(), columna: 'procesado',    texto: textoAleatorio('procesado'),    entrada: Date.now() },
    ])
    timerRef.current = setTimeout(tick, 2_000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [tick])

  return { tarjetas, totalSocios: null, actividadReciente: [] as ActividadReal['actividad_reciente'] }
}

// ─── Modo real ────────────────────────────────────────────────────────────────

const TIPO_TEXTO: Record<string, string> = {
  inicio:       'inicia evaluación',
  calificacion: 'análisis completado',
  cierre:       'plan personalizado generado',
  afiliacion:   'interesado en negocio',
}

function useModoReal() {
  const [tarjetas,          setTarjetas]          = useState<Tarjeta[]>([])
  const [totalSocios,       setTotalSocios]       = useState<number | null>(null)
  const [actividadReciente, setActividadReciente] = useState<ActividadReal['actividad_reciente']>([])

  useEffect(() => {
    let cancelado = false

    const cargar = async () => {
      try {
        const res  = await fetch('/api/admin/actividad-global')
        if (!res.ok || cancelado) return
        const data = await res.json() as ActividadReal

        if (cancelado) return
        setTotalSocios(data.total_socios_activos)
        setActividadReciente(data.actividad_reciente)

        // Construir tarjetas desde conteos — sin PII, solo cantidades
        const nuevas: Tarjeta[] = []
        for (let i = 0; i < Math.min(data.conteos.iniciando,    3); i++)
          nuevas.push({ id: uid(), columna: 'iniciando',    texto: textoAleatorio('iniciando'),    entrada: Date.now() + i })
        for (let i = 0; i < Math.min(data.conteos.cualificando, 3); i++)
          nuevas.push({ id: uid(), columna: 'cualificando', texto: textoAleatorio('cualificando'), entrada: Date.now() + i })
        for (let i = 0; i < Math.min(data.conteos.procesados,   2); i++)
          nuevas.push({ id: uid(), columna: 'procesado',    texto: textoAleatorio('procesado'),    entrada: Date.now() + i })

        // Sobrescribir texto si hay actividad reciente con ubicación real (país, no ciudad)
        data.actividad_reciente.slice(0, 3).forEach((ev, i) => {
          if (nuevas[i]) {
            nuevas[i].texto = `Usuario de ${ev.ubicacion} · ${TIPO_TEXTO[ev.tipo] ?? 'en proceso'}`
          }
        })

        setTarjetas(nuevas)
      } catch { /* silencioso — el widget nunca debe romper la landing */ }
    }

    cargar()
    const interval = setInterval(cargar, 30_000)  // refrescar cada 30s
    return () => { cancelado = true; clearInterval(interval) }
  }, [])

  return { tarjetas, totalSocios, actividadReciente }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function LiveFlowWidget() {
  const modo         = (process.env.NEXT_PUBLIC_ACTIVITY_MODE ?? 'simulated') as 'simulated' | 'real'
  const sim          = useModoSimulado()
  const real         = useModoReal()
  const { tarjetas, totalSocios } = modo === 'real' ? real : sim

  // Agrupar por columna
  const porColumna = (col: Columna) => tarjetas.filter(t => t.columna === col)

  return (
    <div className="w-full max-w-2xl mx-auto select-none">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Actividad en vivo
          </span>
        </div>
        {totalSocios !== null && totalSocios > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span><strong className="text-gray-600">{totalSocios}</strong> socios activos</span>
          </div>
        )}
      </div>

      {/* Kanban Ghost — 3 columnas */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMNAS.map(col => (
          <div
            key={col.id}
            className={`rounded-2xl border p-3 min-h-[160px] ${col.color}`}
          >
            {/* Cabecera columna */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {col.label}
              </p>
              <span className="ml-auto text-[10px] font-mono text-gray-400">
                {porColumna(col.id).length}
              </span>
            </div>

            {/* Tarjetas animadas */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {porColumna(col.id).map(t => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0,  scale: 1     }}
                    exit={{    opacity: 0, y:  8,  scale: 0.95  }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="bg-white/80 backdrop-blur-sm border border-white rounded-xl px-2.5 py-2 shadow-sm"
                  >
                    <div className="flex items-start gap-1.5">
                      <Zap className="w-2.5 h-2.5 text-gray-300 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-gray-500 leading-relaxed">{t.texto}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Placeholder vacío si no hay tarjetas */}
              {porColumna(col.id).length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-10 rounded-xl border border-dashed border-gray-200 flex items-center justify-center"
                >
                  <Activity className="w-3 h-3 text-gray-200" />
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — modo indicator (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <p className="text-center text-[9px] text-gray-300 mt-2 font-mono">
          modo: {modo}
        </p>
      )}
    </div>
  )
}
