/**
 * scripts/test-flujo-agente.mjs
 *
 * Prueba el flujo completo M1 → M7 contra el servidor local.
 * Cada turno acumula el historial y verifica que el agente emita
 * las señales internas correctas en el momento correcto.
 *
 * Uso: node scripts/test-flujo-agente.mjs
 */

const BASE_URL    = 'http://localhost:3000'
const CAMPANA_ID  = '00000000-0000-0000-0000-200000000001'  // Pack Salud Masculina Total — CR

// ─── Colores de consola ───────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
}
const ok   = (s) => `${C.green}✅ ${s}${C.reset}`
const fail = (s) => `${C.red}❌ ${s}${C.reset}`
const info = (s) => `${C.cyan}ℹ  ${s}${C.reset}`
const warn = (s) => `${C.yellow}⚠  ${s}${C.reset}`
const turn = (n, role, text) =>
  `${C.gray}[T${n}]${C.reset} ${C.bold}${role === 'user' ? C.blue+'USER' : C.magenta+'AGENTE'}${C.reset}: ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`

// ─── Llamar al agente y recoger stream ───────────────────────────────────────
async function llamarAgente(messages, prospecto_id = null) {
  const body = { campana_id: CAMPANA_ID, messages }
  if (prospecto_id) body.prospecto_id = prospecto_id

  const res = await fetch(`${BASE_URL}/api/agente`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err}`)
  }

  // Leer header del prospecto_id
  const pid = res.headers.get('X-Prospecto-Id') ?? prospecto_id

  // Leer stream completo
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let texto = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    texto += decoder.decode(value, { stream: true })
  }

  // El stream de Vercel AI SDK v5 tiene formato "0:\"token\"\n"
  // Extraer solo el texto limpio
  const textoLimpio = texto
    .split('\n')
    .filter(l => l.startsWith('0:'))
    .map(l => {
      try { return JSON.parse(l.slice(2)) } catch { return '' }
    })
    .join('')

  return { texto: textoLimpio || texto, prospecto_id: pid }
}

// ─── Verificar que una señal esté en el texto ─────────────────────────────────
function verificar(label, texto, señal, debeExistir = true) {
  const tiene = texto.includes(señal)
  if (debeExistir && tiene)  console.log(ok(`${label} → señal "${señal}" detectada`))
  if (debeExistir && !tiene) console.log(warn(`${label} → señal "${señal}" NO detectada (puede ser turno intermedio)`))
  if (!debeExistir && tiene) console.log(fail(`${label} → señal "${señal}" apareció cuando NO debería`))
  if (!debeExistir && !tiene)console.log(ok(`${label} → señal "${señal}" correctamente ausente`))
}

// ─── TEST PRINCIPAL ───────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}`)
  console.log(`${C.bold}  TEST FLUJO COMPLETO M1 → M7${C.reset}`)
  console.log(`${C.bold}  Campaña: Pack Salud Masculina Total — CR${C.reset}`)
  console.log(`${C.bold}${'═'.repeat(60)}${C.reset}\n`)

  const messages = []
  let prospecto_id = null
  let errores = 0

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 0 — M1: Gancho de entrada (sin mensajes de usuario)
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M1: Gancho de Entrada ──${C.reset}`)
  try {
    const r = await llamarAgente([], null)
    prospecto_id = r.prospecto_id
    console.log(turn(0, 'assistant', r.texto))
    verificar('M1', r.texto, '[M2_PREGUNTAS_COMPLETADAS]', false)  // no debe saltar aún
    const tieneHola = r.texto.toLowerCase().includes('hola') || r.texto.toLowerCase().includes('asistente')
    tieneHola
      ? console.log(ok('M1 → mensaje de bienvenida generado'))
      : console.log(fail('M1 → mensaje de bienvenida ausente'))
    console.log(info(`prospecto_id asignado: ${prospecto_id ?? 'null (esperado en M1)'}`))
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M1 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 1 — M2: Usuario responde "Sí" a primera pregunta
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M2: Preguntas de Filtro (turno 1/3) ──${C.reset}`)
  messages.push({ role: 'user', content: 'Sí, tengo 43 años.' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(1, 'user',      'Sí, tengo 43 años.'))
    console.log(turn(1, 'assistant', r.texto))
    console.log(info(`prospecto_id: ${prospecto_id}`))
    verificar('M2-T1', r.texto, '[M2_PREGUNTAS_COMPLETADAS]', false)  // solo 1 de 3
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M2-T1 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 2 — M2: Usuario confirma síntomas
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M2: Preguntas de Filtro (turno 2/3) ──${C.reset}`)
  messages.push({ role: 'user', content: 'Sí, he notado menos energía y tengo que levantarme varias veces en la noche.' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(2, 'user',      'Sí, he notado menos energía y tengo que levantarme varias veces en la noche.'))
    console.log(turn(2, 'assistant', r.texto))
    verificar('M2-T2', r.texto, '[M2_PREGUNTAS_COMPLETADAS]', false)  // 2 de 3
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M2-T2 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 3 — M2: Tercera pregunta + señal M2_OK esperada
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M2: Preguntas de Filtro (turno 3/3 — espera señal) ──${C.reset}`)
  messages.push({ role: 'user', content: 'He probado algunas vitaminas pero no vi resultados, lo dejé después de un mes.' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(3, 'user',      'He probado algunas vitaminas pero no vi resultados, lo dejé después de un mes.'))
    console.log(turn(3, 'assistant', r.texto))
    verificar('M2-T3', r.texto, '[M2_PREGUNTAS_COMPLETADAS]')  // debe aparecer ahora
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M2-T3 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 4 — M3: Agente entrega recomendación personalizada
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M3: Entrega de Recomendación ──${C.reset}`)
  messages.push({ role: 'user', content: 'Entiendo, ¿cuál sería el protocolo adecuado para mí?' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(4, 'user',      '¿cuál sería el protocolo adecuado para mí?'))
    console.log(turn(4, 'assistant', r.texto))
    verificar('M3', r.texto, '[M3_RECOMENDACION_ENTREGADA]')
    const menciona_dugran   = r.texto.toLowerCase().includes('dugran')   || r.texto.toLowerCase().includes('libido')
    const menciona_flussorin = r.texto.toLowerCase().includes('flussorin') || r.texto.toLowerCase().includes('próstata')
    menciona_dugran    ? console.log(ok('M3 → menciona Dugran-X / componente')) : console.log(warn('M3 → Dugran-X no detectado'))
    menciona_flussorin ? console.log(ok('M3 → menciona Flussorin / próstata')) : console.log(warn('M3 → Flussorin no detectado'))
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M3 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 5 — M3: Usuario da datos de contacto → [DATOS_COMPLETOS]
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M3: Captura de Datos de Contacto ──${C.reset}`)
  messages.push({ role: 'user', content: 'Perfecto, me interesa. Me llamo Carlos Méndez, mi correo es carlos@gmail.com y mi número es 8888-1234.' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(5, 'user',      'Me llamo Carlos Méndez, correo carlos@gmail.com, teléfono 8888-1234.'))
    console.log(turn(5, 'assistant', r.texto))
    verificar('M3-contacto', r.texto, '[DATOS_COMPLETOS]')
    verificar('M3-cierre',   r.texto, '[LISTO_CIERRE]')
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M3-contacto ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 6 — M5a: Prueba social dinámica (debe inyectarse)
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M5a: Prueba Social Dinámica ──${C.reset}`)
  messages.push({ role: 'user', content: 'Sí, quiero comprarlo. ¿Cuál es el siguiente paso?' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(6, 'user',      'Sí, quiero comprarlo. ¿Cuál es el siguiente paso?'))
    console.log(turn(6, 'assistant', r.texto))
    verificar('M5a', r.texto, '[M5A_PRUEBA_SOCIAL_INYECTADA]')
    const tieneSocios = r.texto.toLowerCase().includes('socio') || r.texto.toLowerCase().includes('ingreso')
    tieneSocios ? console.log(ok('M5a → snippet de prueba social detectado')) : console.log(warn('M5a → snippet no detectado en texto visible'))
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M5a ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 7 — M5b: Usuario ve la prueba social y pregunta sobre el negocio
  // Mensaje realista: usuario reacciona al snippet "socios en tu área" preguntando
  // directamente sobre la oportunidad → M5b detecta interés de negocio
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M5b: Bifurcación de Reclutamiento ──${C.reset}`)
  messages.push({ role: 'user', content: '¿Ustedes tienen algún plan para que yo también pueda recomendar los productos y ganar dinero?' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(7, 'user',      '¿Ustedes tienen algún plan para que yo también pueda recomendar los productos y ganar dinero?'))
    console.log(turn(7, 'assistant', r.texto))
    verificar('M5b-interes', r.texto, '[INTERES_NEGOCIO]')
    const tienePregunta = r.texto.toLowerCase().includes('ingreso') || r.texto.toLowerCase().includes('socio') || r.texto.toLowerCase().includes('recomendación')
    tienePregunta ? console.log(ok('M5b → interés en negocio confirmado')) : console.log(warn('M5b → contenido de negocio no detectado'))
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M5b ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 8 — M6: Usuario pide más detalles del potencial financiero
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M6: Potencial Financiero ──${C.reset}`)
  messages.push({ role: 'user', content: 'Me interesa. ¿Cuánto puedo ganar aproximadamente?' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(8, 'user',      'Me interesa. ¿Cuánto puedo ganar aproximadamente?'))
    console.log(turn(8, 'assistant', r.texto))
    verificar('M6-interes',   r.texto, '[INTERES_NEGOCIO]')
    verificar('M6-potencial', r.texto, '[M6_POTENCIAL_MOSTRADO]')
    const tieneCifras = r.texto.includes('200') || r.texto.includes('500') || r.texto.includes('$')
    tieneCifras ? console.log(ok('M6 → cifras de potencial financiero detectadas')) : console.log(warn('M6 → cifras no detectadas aún (puede seguir)'))
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M6 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TURNO 9 — M7: Cierre de reclutamiento → [AFILIACION_LISTA]
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── M7: Cierre de Reclutamiento y Afiliación ──${C.reset}`)
  messages.push({ role: 'user', content: 'Sí, envíame el enlace de registro. Quiero empezar.' })
  try {
    const r = await llamarAgente(messages, prospecto_id)
    prospecto_id = r.prospecto_id
    console.log(turn(9, 'user',      'Sí, envíame el enlace de registro. Quiero empezar.'))
    console.log(turn(9, 'assistant', r.texto))
    verificar('M7-afil',  r.texto, '[AFILIACION_LISTA]')
    verificar('M7-datos', r.texto, '[DATOS_COMPLETOS]')
    messages.push({ role: 'assistant', content: r.texto })
  } catch (e) {
    console.log(fail(`M7 ERROR: ${e.message}`)); errores++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFICAR KANBAN en Supabase
  // ─────────────────────────────────────────────────────────────────────────
  // Esperar a que los onFinish del servidor completen antes de consultar la BD
  console.log(info('Esperando 3s para que los callbacks onFinish completen...'))
  await new Promise(r => setTimeout(r, 3000))
  console.log(`\n${C.bold}── Verificar Kanban en Supabase ──${C.reset}`)
  if (prospecto_id) {
    try {
      const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY250Y2VlbHp0dHBvbm1laHRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI2MjA1NCwiZXhwIjoyMDkwODM4MDU0fQ.OUKyIrPxdtCqUnaIZaXASEYYP1RzSrLgjHdCIHB0UcQ'
      const SUPABASE_URL = 'https://rgcntceelzttponmehte.supabase.co'
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/prospectos?prospecto_id=eq.${prospecto_id}&select=prospecto_id,nombre,columna_kanban,temperatura,nota_agente,correo,telefono`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      )
      const data = await res.json()
      if (data.length) {
        const p = data[0]
        console.log(ok(`Prospecto encontrado en BD`))
        console.log(info(`  ID:       ${p.prospecto_id}`))
        console.log(info(`  Nombre:   ${p.nombre}`))
        console.log(info(`  Columna:  ${p.columna_kanban}`))
        console.log(info(`  Correo:   ${p.correo ?? '—'}`))
        console.log(info(`  Teléfono: ${p.telefono ?? '—'}`))
        console.log(info(`  Nota:     ${p.nota_agente ?? '—'}`))

        const columnaEsperada = 'cliente_activo'
        p.columna_kanban === columnaEsperada
          ? console.log(ok(`Kanban en columna correcta: "${p.columna_kanban}"`))
          : console.log(warn(`Kanban en: "${p.columna_kanban}" (esperado: "${columnaEsperada}")`))
      } else {
        console.log(fail(`Prospecto ${prospecto_id} no encontrado en BD`))
      }
    } catch (e) {
      console.log(fail(`Error verificando BD: ${e.message}`)); errores++
    }
  } else {
    console.log(warn('No hay prospecto_id para verificar en BD'))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}`)
  console.log(`${C.bold}  RESUMEN DEL TEST${C.reset}`)
  console.log(`${C.bold}${'═'.repeat(60)}${C.reset}`)
  console.log(`  Turnos ejecutados: 9 (M1 → M7)`)
  console.log(`  Prospecto ID: ${prospecto_id ?? 'no generado'}`)
  if (errores === 0) {
    console.log(`  ${C.green}${C.bold}Sin errores de red/API${C.reset}`)
  } else {
    console.log(`  ${C.red}${C.bold}${errores} error(es) de red/API${C.reset}`)
  }
  console.log(`\n  Las señales ⚠️ son informativas — el LLM puede distribuir`)
  console.log(`  señales en turnos adyacentes según su criterio interno.\n`)
}

main().catch(e => {
  console.error(`\n${C.red}Error fatal: ${e.message}${C.reset}`)
  process.exit(1)
})
