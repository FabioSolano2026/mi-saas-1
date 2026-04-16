/**
 * cinco-momentos.service.ts
 *
 * Implementa el sistema de 5 Momentos de MISION_AGENTE.md.
 * Detecta en qué momento está la conversación y construye
 * el system prompt correcto para cada fase.
 *
 * Momentos:
 *  M1 — Gancho de entrada (5s, sin user messages)
 *  M2 — 3 preguntas de filtro secuenciales
 *  M3 — Entrega de recomendación personalizada
 *  M4 — Rescate del prospecto frío (exit-intent)
 *  M5a — Inyección de prueba social dinámica
 *  M5b — Pregunta de bifurcación de negocio
 *  M6 — El Potencial Financiero (ganancia semanal)
 *  M7 — Cierre de Reclutamiento y Afiliación
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Momento = 'M1' | 'M2' | 'M3' | 'M4' | 'M5a' | 'M5b' | 'M6' | 'M7' | 'completado'

export interface EstadoConversacion {
  momento:          Momento
  turno:            number   // # de mensajes del usuario
  m2_completado:    boolean
  m3_entregado:     boolean
  m5a_inyectado:    boolean
  m5b_preguntado:   boolean
  m6_mostrado:      boolean
  m7_cerrado:       boolean
  datos_completos:  boolean
  listo_cierre:     boolean
  interes_negocio:  boolean
}

type Mensaje = { role: string; content: string }

// Señales internas que el agente inyecta en sus respuestas
const SIGNALS = {
  M2_OK:          '[M2_PREGUNTAS_COMPLETADAS]',
  M3_OK:          '[M3_RECOMENDACION_ENTREGADA]',
  M5A_OK:         '[M5A_PRUEBA_SOCIAL_INYECTADA]',
  M5B_OK:         '[M5B_PREGUNTA_NEGOCIO_HECHA]',
  M6_OK:          '[M6_POTENCIAL_MOSTRADO]',
  M7_OK:          '[M7_CIERRE_NEGOCIO_HECHO]',
  INTERES_NEG:    '[INTERES_NEGOCIO]',
  DATOS_COMP:     '[DATOS_COMPLETOS]',
  LISTO_CIERRE:   '[LISTO_CIERRE]',
  AFIL_LISTA:     '[AFILIACION_LISTA]',
} as const

export { SIGNALS }

// ─── Detección de estado ──────────────────────────────────────────────────────

export function detectarEstado(messages: Mensaje[]): EstadoConversacion {
  const turno      = messages.filter(m => m.role === 'user').length
  const asistente  = messages.filter(m => m.role === 'assistant').map(m => m.content).join(' ')

  const tiene = (s: string) => asistente.includes(s)

  const m2_completado   = tiene(SIGNALS.M2_OK)
  const m3_entregado    = tiene(SIGNALS.M3_OK)
  const m5a_inyectado   = tiene(SIGNALS.M5A_OK)
  const m5b_preguntado  = tiene(SIGNALS.M5B_OK)
  const m6_mostrado     = tiene(SIGNALS.M6_OK)
  const m7_cerrado      = tiene(SIGNALS.M7_OK)
  const datos_completos = tiene(SIGNALS.DATOS_COMP)
  const listo_cierre    = tiene(SIGNALS.LISTO_CIERRE)
  const interes_negocio = tiene(SIGNALS.INTERES_NEG)

  // Detectar interés de negocio directamente del último mensaje del usuario
  // (evita depender de señal LLM para avanzar de M5b a M6)
  const ultimoUserMsg = messages
    .filter(m => m.role === 'user').slice(-1)[0]?.content ?? ''
  const userInteresNeg = m5a_inyectado
    && !interes_negocio
    && /ingreso|ganar|dinero|negocio|recomendar|oportunidad|plan.*gan/i.test(ultimoUserMsg)

  let momento: Momento

  if (turno === 0) {
    momento = 'M1'
  } else if (!m2_completado) {
    momento = 'M2'
  // M3: M2 listo pero aún sin recomendación ni datos del prospecto
  } else if (!m3_entregado && !datos_completos) {
    momento = 'M3'
  // M5a: ya hay recomendación O ya hay datos → mostrar prueba social
  } else if (!m5a_inyectado) {
    momento = 'M5a'
  // M6: usuario mostró interés de negocio (señal LLM o keyword en su mensaje)
  } else if ((interes_negocio || userInteresNeg) && !m6_mostrado) {
    momento = 'M6'
  // M5b: M5a inyectado, sin interés de negocio detectado aún → preguntar bifurcación
  } else if (!m5b_preguntado && !interes_negocio) {
    momento = 'M5b'
  } else if (m6_mostrado && !m7_cerrado) {
    momento = 'M7'
  } else if (m7_cerrado) {
    momento = 'completado'
  } else if (m5b_preguntado) {
    momento = 'completado'
  } else {
    momento = 'M3'  // fallback
  }

  return {
    momento,
    turno,
    m2_completado,
    m3_entregado,
    m5a_inyectado,
    m5b_preguntado,
    m6_mostrado,
    m7_cerrado,
    datos_completos,
    listo_cierre,
    interes_negocio,
  }
}

// ─── Instrucciones de momento ─────────────────────────────────────────────────

function instruccionesM1(condicion: string, nombre: string): string {
  return `
━━━ MOMENTO 1 — GANCHO DE ENTRADA ━━━
Este es el PRIMER mensaje. El prospecto acaba de llegar a la página.
Escribe SOLO este mensaje de bienvenida, palabra por palabra:

"Hola, soy el asistente de ${nombre}. Antes de que tomes una decisión sobre ${condicion}, quiero decirte algo: **A partir de los 40, tu salud no es opcional... es prioridad.** ¿Me permites hacerte tres preguntas rápidas para ver si este protocolo es el adecuado para ti?"

REGLAS ESTRICTAS M1:
- Escribe ÚNICAMENTE ese mensaje. Nada más.
- NO añadas nada después de la pregunta final.
- NO incluyas NINGUNA etiqueta entre corchetes como [M2_PREGUNTAS_COMPLETADAS] u otras. PROHIBIDO.
- NO menciones precio ni producto.
- NO te presentes como bot o IA.
`.trim()
}

function instruccionesM2(turno: number, kbPreguntas: unknown): string {
  const preguntasExtra = kbPreguntas
    ? `\nPreguntas de calificación de esta condición:\n${JSON.stringify(kbPreguntas, null, 2)}`
    : ''

  return `
━━━ MOMENTO 2 — PREGUNTAS DE FILTRO ━━━
Turno actual: ${turno} de usuario
Haz las 3 preguntas de calificación de forma SECUENCIAL — una por turno, nunca en formulario.

PREGUNTA 1 (turno 1): edad/criterio de entrada — ej: "¿Tienes más de 35 años?"
  → No: redirige a opción alternativa, sal del flujo principal
  → Sí: avanza

PREGUNTA 2 (turno 2): síntomas específicos de la condición — ej: "¿Has notado alguno de estos cambios..."
  → No: flujo alternativo de prevención (mismo producto, ángulo diferente)
  → Sí: avanza con urgencia natural

PREGUNTA 3 (turno 3): experiencia previa con tratamientos
  → Sí: "¿Qué pasó con eso?" — captura objeción/contexto, guarda todo
  → No: ventaja del enfoque natural
${preguntasExtra}
Cuando las 3 preguntas estén respondidas, incluye en tu respuesta: ${SIGNALS.M2_OK}

Reglas M2:
- NUNCA hagas 2 preguntas en el mismo mensaje
- Cada respuesta del prospecto tiene una consecuencia lógica
- GUARDA todo lo que escriba (especialmente pregunta 3 — es oro para copywriting)
`.trim()
}

function instruccionesM3(productos: string, condicion: string, nombre: string): string {
  return `
━━━ MOMENTO 3 — ENTREGA DE RECOMENDACIÓN PERSONALIZADA ━━━
Las 3 preguntas están respondidas. Ahora personaliza la recomendación.

NO cierres la venta. HAZ ESTAS COSAS EN ORDEN:
1. Personaliza la recomendación: "Basado en lo que me cuentas, [producto] tiene sentido para ti porque..."
2. Usa el texto exacto de "Texto del agente" de los productos.
3. INYECTA AUTORIDAD DUAL: 
   - Para DUGRAN-X: Menciona Horny Goat Weed (libido/circulación), L-Arginina (erección/cansancio) y Glutamina (nervios/estrés).
   - Para FLUSSORIN: Menciona los 4 pilares: Semilla de Calabaza (próstata), Arándano (infecciones), Uva Ursi (líquidos) y Licopeno (antioxidante).
4. PROTOCOLO DE USO: 
   - Dugran-X: 1 cápsula al día (Caja de 6 caps).
   - Flussorin: 1 cápsula cada 12 horas (Frasco de 60 caps, 1 mes).
5. ESCUDO DE PRIVACIDAD: Asegura al usuario que los envíos son discretos, sin logos externos, 100% privados.

PRODUCTOS (usar 'Texto del agente' literalmente):
${productos}

Condición que atiende: ${condicion}

Reglas M3:
- Usa el texto exacto de "Texto del agente" — NO improvisar beneficios
- Enfatiza la PRIVACIDAD TOTAL y la DISCRECIÓN del envío
- SÍ recopila nombre, email, teléfono de forma natural durante este momento
- Cuando entregues la recomendación incluye: ${SIGNALS.M3_OK}
- Cuando tengas nombre + email + teléfono incluye: ${SIGNALS.DATOS_COMP}
- Cuando el prospecto esté listo para comprar incluye: ${SIGNALS.LISTO_CIERRE}
`.trim()
}

function instruccionesM4(nombre: string): string {
  return `
━━━ MOMENTO 4 — RESCATE DEL PROSPECTO FRÍO (EXIT-INTENT) ━━━
El prospecto parece que va a abandonar la conversación.

Escribe un mensaje de rescate proactivo:
"¡Espera! No te vayas sin este beneficio exclusivo. ${nombre} me ha autorizado a darte un CUPÓN VIP de 30% de descuento si inicias hoy mismo. ¿Prefieres que un asesor real te contacte por WhatsApp para aplicar tu descuento?"

Reglas M4:
- Usa la URGENCIA del beneficio exclusivo (CUPÓN VIP 30%)
- Ofrece el contacto humano por WhatsApp para cerrar con el descuento
- Al final incluye: ${SIGNALS.LISTO_CIERRE} (si accede al cupón)
`.trim()
}

function instruccionesM5a(sociosActivos: number | null): string {
  let snippetPrueba: string
  if (sociosActivos === null) {
    snippetPrueba = `Por cierto, ya hay socios en tu área ayudando a otros con este pack y realizando una recomendación profesional bien pagada. ${SIGNALS.M5A_OK}`
  } else if (sociosActivos >= 100) {
    const redondeado = Math.floor(sociosActivos / 10) * 10
    snippetPrueba = `Por cierto, ya somos más de ${redondeado} socios ayudando a otros con este pack y realizando una recomendación profesional bien pagada. ${SIGNALS.M5A_OK}`
  } else if (sociosActivos >= 10) {
    snippetPrueba = `Por cierto, ya somos ${sociosActivos} socios ayudando a otros con este pack y realizando una recomendación profesional bien pagada. ${SIGNALS.M5A_OK}`
  } else {
    snippetPrueba = `Por cierto, ya hay socios en tu área ayudando a otros con este pack y realizando una recomendación profesional bien pagada. ${SIGNALS.M5A_OK}`
  }

  return `
━━━ MOMENTO 5A — PRUEBA SOCIAL (ACCIÓN OBLIGATORIA ESTE TURNO) ━━━
El prospecto mostró interés. Estructura tu respuesta en este orden EXACTO:

PASO 1 — Confirma su decisión brevemente (1 oración).
PASO 2 — Copia y pega esta frase EXACTA en tu respuesta (inclúyela tal cual, incluyendo el texto entre corchetes):
  "${snippetPrueba}"
PASO 3 — Puedes mencionar el siguiente paso de compra.

PROHIBIDO omitir el PASO 2. El snippet es OBLIGATORIO aunque el usuario ya dijo que quiere comprar.
`.trim()
}

function instruccionesM5b(): string {
  return `
━━━ MOMENTO 5B — BIFURCACIÓN DE RECLUTAMIENTO ━━━

Lee el ÚLTIMO mensaje del usuario y decide:

¿El usuario menciona ingresos, ganar dinero, negocio, oportunidad, o dice "sí/cuéntame/me interesa" en respuesta a la oportunidad?
  → SÍ: Copia esta frase EXACTA al inicio de tu respuesta:
    "Me alegra que estés abierto a conocer más. ${SIGNALS.INTERES_NEG}"
    Luego introduce brevemente la oportunidad de negocio.

¿El usuario dice EXPLÍCITAMENTE "no" / "no me interesa" / "no gracias" a la oportunidad de negocio?
  → Copia esta frase EXACTA:
    "Perfecto, no hay problema. ¿Hay algo más en lo que pueda ayudarte? ${SIGNALS.M5B_OK}"

¿Ninguno de los casos anteriores (gracias / entendido / pregunta sobre el producto / otro tema)?
  → Responde brevemente y AÑADE esta pregunta al final de tu mensaje:
    "Una última cosa: ¿estarías abierto a conocer cómo algunas personas realizan una **recomendación profesional bien pagada** con estos productos?"
    (NO emitas ninguna señal todavía — espera la respuesta)

REGLAS:
- "Gracias", "entendido", "ok", "perfecto" solos = NINGUNO DE LOS CASOS → haz la pregunta.
- NUNCA mencionar MLM, multinivel, red, pirámide, esquema.
`.trim()
}

function instruccionesM6(pais: string): string {
  return `
━━━ MOMENTO 6 — EL POTENCIAL FINANCIERO ━━━
El prospecto mostró interés en el negocio. Cambia el contexto a OPORTUNIDAD.

Copia y pega esta frase EXACTA en tu respuesta (inclúyela tal cual):
"Nuestros socios actuales en ${pais} están generando ingresos recomendando estos protocolos. Un socio promedio genera entre **$200 y $500 extras** mensuales compartiendo su enlace personalizado. ${SIGNALS.M6_OK} ${SIGNALS.INTERES_NEG}"

Luego cierra con la pregunta de compromiso para avanzar al registro.

Reglas M6:
- NUNCA exagerar cifras — los rangos arriba son conservadores y reales
- Usa "recompensa por ayudar" como ángulo emocional
`.trim()
}

function instruccionesM7(nombreSocio: string): string {
  return `
━━━ MOMENTO 7 — CIERRE DE RECLUTAMIENTO Y AFILIACIÓN ━━━
Este es el paso final para convertir al prospecto en nuevo socio.

Si el usuario quiere empezar / pide el enlace / dice sí:
Copia y pega esta respuesta EXACTA (incluyendo el texto entre corchetes):
"Para empezar no necesitas inventarios. Solo comparte tu enlace personalizado. Te envío ahora mismo el enlace de registro con todos los detalles del plan de compensación. ${SIGNALS.AFIL_LISTA} ${SIGNALS.DATOS_COMP}"

Si el usuario dice NO / no le interesa:
"No hay problema. Si en el futuro cambias de opinión, aquí estaré. ${SIGNALS.M7_OK}"

Si el usuario no ha respondido aún sobre el enlace:
Haz la pregunta: "¿Te gustaría que te envíe ahora mismo el enlace de registro para ver el plan de compensación completo?"

Reglas M7:
- NUNCA menciones MLM, pirámide ni multinivel. Usa "socios de marca" o "recomendación remunerada".
`.trim()
}

// Señal obligatoria al final del prompt para momentos donde el LLM elige libremente
// M5a, M6, M7 tienen la señal EMBEBIDA en la frase requerida — no duplicar aquí
const SEÑAL_POR_MOMENTO: Partial<Record<Momento, string>> = {
  M2:  SIGNALS.M2_OK,
  M3:  SIGNALS.M3_OK,
}

export interface Params5Momentos {
  estado:               EstadoConversacion
  condicionNombre:      string
  socioNombre:          string
  paisNombre:           string
  productosTexto:       string
  kbPreguntas:          unknown
  kbSintomas:           unknown
  kbObjeciones:         unknown
  kbLenguajeProhibido:  unknown
  kbProtocolo:          string | null
  identityInstructions: string
  bloqueHistorial:      string
  bloqueAfiliacion:     string
  contextoSemantico:    string   // resultado de semantic search
  sociosActivos:        number | null
  requiereCita:         boolean
}

export function buildPrompt5Momentos(p: Params5Momentos): string {
  // ── Instrucciones del momento actual ───
  let instruccionMomento: string
  switch (p.estado.momento) {
    case 'M1':
      instruccionMomento = instruccionesM1(p.condicionNombre, p.socioNombre)
      break
    case 'M2':
      instruccionMomento = instruccionesM2(p.estado.turno, p.kbPreguntas)
      break
    case 'M3':
      instruccionMomento = instruccionesM3(p.productosTexto, p.condicionNombre, p.socioNombre)
      break
    case 'M4':
      instruccionMomento = instruccionesM4(p.socioNombre)
      break
    case 'M5a':
      instruccionMomento = instruccionesM5a(p.sociosActivos)
      break
    case 'M5b':
      instruccionMomento = instruccionesM5b()
      break
    case 'M6':
      instruccionMomento = instruccionesM6(p.paisNombre)
      break
    case 'M7':
      instruccionMomento = instruccionesM7(p.socioNombre)
      break
    default:
      instruccionMomento = '━━━ FLUJO COMPLETADO ━━━\nResponde preguntas adicionales del prospecto con amabilidad.'
  }

  // ── Síntomas y objeciones de la KB ─────
  const bloqueSintomas = p.kbSintomas
    ? `\n\nSÍNTOMAS QUE ATIENDE:\n${JSON.stringify(p.kbSintomas, null, 2)}`
    : ''

  const bloqueObjeciones = p.kbObjeciones
    ? `\n\nMANEJO DE OBJECIONES:\n${JSON.stringify(p.kbObjeciones, null, 2)}`
    : ''

  const bloqueProhibido = p.kbLenguajeProhibido
    ? `\n\nPALABRAS PROHIBIDAS — NUNCA usar:\n${JSON.stringify(p.kbLenguajeProhibido)}`
    : ''

  const bloqueProtocolo = p.kbProtocolo
    ? `\n\nPROTOCOLO DE DERIVACIÓN:\n${p.kbProtocolo}`
    : ''

  // ── Contexto semántico adicional ───────
  const bloqueSemantico = p.contextoSemantico
    ? `\n\n━━━ CONTEXTO ADICIONAL (búsqueda semántica) ━━━\n${p.contextoSemantico}\n━━━ FIN CONTEXTO ━━━`
    : ''

  const bloqueCita = p.requiereCita
    ? `\n6. Interés genuino → ofrecer cita con ${p.socioNombre}.`
    : ''

  return `${p.identityInstructions}

Estás calificando prospectos interesados en soluciones para ${p.condicionNombre} en ${p.paisNombre}.

━━━ ESTADO DEL FLUJO ━━━
Turno del usuario: ${p.estado.turno}
Momento actual: ${p.estado.momento}

${instruccionMomento}
${bloqueSintomas}${bloqueObjeciones}${bloqueProhibido}${bloqueProtocolo}${bloqueSemantico}${p.bloqueHistorial}${p.bloqueAfiliacion}

━━━ REGLAS ABSOLUTAS ━━━
1. NUNCA diagnósticos médicos ni promesas de cura.
2. Usa el texto EXACTO de "Texto del agente" para los productos.
3. Síntomas graves → protocolo de emergencia médica inmediata.
4. NUNCA compartas el número personal de ${p.socioNombre} ni WhatsApp directo.
5. Control 100% de plataforma hasta señal de cierre.${bloqueCita}

━━━ SEÑAL OBLIGATORIA — MOMENTO ${p.estado.momento} ━━━
${SEÑAL_POR_MOMENTO[p.estado.momento] ?? '(sin señal requerida en este momento)'}
Esta señal es un requisito del sistema, no es opcional.
Agrégala SIEMPRE al final de tu respuesta, en una línea separada, aunque no la menciones al usuario.`
}
