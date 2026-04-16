import { streamText }               from 'ai'
import { chatModel }                 from '@/lib/ai-provider'
import { NextResponse }              from 'next/server'
import { z }                         from 'zod'
import { getContextualData }         from '@/features/agente/services/contextual-data.service'
import { leerContextoAgente }        from '@/features/agente/services/contexto-historico.service'
import { activarSwitchCierre }       from '@/features/embudo/services/embudo.service'
import { iniciarFlujoAfiliacion }    from '@/features/embudo/services/afiliacion.service'
import {
  cargarIdentidadSocio,
  buildIdentityInstructions,
}                                    from '@/features/agente/services/identity.service'
import type { FaseIdentidad }        from '@/features/agente/services/identity.service'
import {
  buscarContextoRelevante,
  buildQueryFromMessages,
}                                    from '@/features/agente/services/semantic-search.service'
import {
  detectarEstado,
  buildPrompt5Momentos,
  SIGNALS,
}                                    from '@/features/agente/services/cinco-momentos.service'
import {
  crearProspectoAnonimo,
  procesarSeñales,
}                                    from '@/features/agente/services/auto-prospecto.service'

// ─── Schema de request ────────────────────────────────────────────────────────

const uuidLoose = z.string().regex(/^[0-9a-f-]{36}$/i, 'Invalid UUID')

const AgenteRequestSchema = z.object({
  campana_id:   uuidLoose,
  messages:     z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  prospecto_id: uuidLoose.optional(),
  prospecto:    z.object({
    nombre:   z.string().optional(),
    email:    z.string().optional(),
    telefono: z.string().optional(),
  }).optional(),
})

// ─── POST /api/agente — endpoint público (sin auth de socio) ──────────────────

export async function POST(request: Request) {
  const body   = await request.json()
  const parsed = AgenteRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { campana_id, messages, prospecto_id: incomingProspectoId, prospecto: datosProspecto } = parsed.data

  // ─── 1. Cargar contexto de la campaña ──────────────────────────────────────
  let ctx
  try {
    ctx = await getContextualData(campana_id)
  } catch {
    return NextResponse.json({ error: 'Campaña no encontrada o inactiva' }, { status: 404 })
  }

  // ─── 2. Auto-crear prospecto en primer mensaje del usuario ─────────────────
  let prospecto_id = incomingProspectoId ?? null
  const userTurns  = messages.filter(m => m.role === 'user').length

  if (!prospecto_id && userTurns > 0) {
    prospecto_id = await crearProspectoAnonimo({
      tenant_id:  ctx.campana.tenant_id,
      campana_id: ctx.campana.campana_id,
      socio_id:   ctx.socio?.usuario_id ?? null,
      pais_id:    ctx.campana.pais_id,
    })
  }

  // ─── 3. Identidad del socio ────────────────────────────────────────────────
  const socioId  = ctx.socio?.usuario_id ?? null
  const identidad = socioId
    ? await cargarIdentidadSocio(socioId).catch(() => null)
    : null

  // ─── 4. Estado del flujo de 5 Momentos ────────────────────────────────────
  const estado = detectarEstado(messages)

  // ─── 5. Fase de identidad (para switch callcenter / automático) ────────────
  const ultimoAsistente = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''
  const fase: FaseIdentidad =
    ultimoAsistente.includes(SIGNALS.AFIL_LISTA)
      ? 'afiliacion'
      : ultimoAsistente.includes(SIGNALS.LISTO_CIERRE)
        ? 'cierre'
        : 'calificacion'

  // ─── 6. Historial del prospecto ────────────────────────────────────────────
  const contextoLead = prospecto_id
    ? await leerContextoAgente(prospecto_id).catch(() => null)
    : null

  let bloqueHistorial = ''
  if (contextoLead) {
    bloqueHistorial = contextoLead.resumen_validado
      ? `\n\n━━━ HISTORIAL PREVIO VALIDADO ✅ ━━━\n${contextoLead.resumen}\n━━━ FIN ━━━\nNo repitas preguntas ya respondidas.`
      : `\n\n━━━ HISTORIAL PREVIO ⚠️ ━━━\n${contextoLead.resumen}\n━━━ FIN ━━━\nUsar como orientación.`
  }

  // ─── 7. Bloque de afiliación ───────────────────────────────────────────────
  let bloqueAfiliacion = ''
  const socioNombre    = identidad?.nombre ?? ctx.socio?.nombre_completo ?? 'el especialista'
  if (fase === 'afiliacion' && identidad) {
    const idAfil = identidad.id_afiliado
    if (identidad.tipo_cierre === 'callcenter') {
      const tel = identidad.callcenter_telefono ?? 'el número que te indicaré'
      bloqueAfiliacion = `\n\n━━━ FLUJO DE AFILIACIÓN — CallCenter ━━━
ID AFILIADO ${socioNombre.toUpperCase()}: ${idAfil} | TEL: ${tel}
Entrega el script de llamada exacto. Asegura que anoten el ID. [SCRIPT_LLAMADA_ENTREGADO]`
    } else {
      const link = identidad.portal_registro_url ?? identidad.callcenter_url
      bloqueAfiliacion = `\n\n━━━ FLUJO DE AFILIACIÓN — Automático ━━━
ID AFILIADO ${socioNombre.toUpperCase()}: ${idAfil}
PORTAL: ${link ?? 'pendiente de configuración'}
Da el link y el ID. Confirma que en "patrocinador" ponga: ${idAfil}. [AFILIACION_EN_PROCESO]`
    }
  }

  // ─── 8. Búsqueda semántica (solo si hay mensajes del usuario) ─────────────
  let contextoSemantico = ''
  if (userTurns > 0) {
    const query = buildQueryFromMessages(messages)
    const resultado = await buscarContextoRelevante({
      query,
      tenant_id: ctx.campana.tenant_id,
    }).catch(() => ({ kbContexto: '', ingredientesContexto: '', tieneContexto: false }))

    if (resultado.tieneContexto) {
      const partes: string[] = []
      if (resultado.kbContexto)           partes.push(resultado.kbContexto)
      if (resultado.ingredientesContexto) partes.push(`Ingredientes relevantes:\n${resultado.ingredientesContexto}`)
      contextoSemantico = partes.join('\n\n')
    }
  }

  // ─── 9. Contador de socios activos para Momento 5A ────────────────────────
  let sociosActivos: number | null = null
  if (estado.momento === 'M5a') {
    try {
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/agente/social-proof?campana_id=${campana_id}`,
      )
      if (resp.ok) {
        const spData = await resp.json() as { numero: number | null }
        sociosActivos = spData.numero
      }
    } catch { /* fallo silencioso */ }
  }

  // ─── 10. Productos ────────────────────────────────────────────────────────
  const productosTexto = ctx.productos.length
    ? ctx.productos.map(p =>
        [
          `- ${p.nombre} (prioridad ${p.prioridad})`,
          `  Texto del agente: "${p.lenguaje_agente}"`,
          p.razon_recomendacion ? `  Razón: ${p.razon_recomendacion}` : '',
        ].filter(Boolean).join('\n'),
      ).join('\n\n')
    : 'Consulta con el especialista para recomendaciones personalizadas.'

  // ─── 11. Instrucciones de identidad ───────────────────────────────────────
  const identityInstructions = identidad
    ? buildIdentityInstructions(identidad, fase)
    : `Representas a ${socioNombre}. Tono profesional y empático.`

  // ─── 12. System prompt con 5 Momentos ────────────────────────────────────
  const kb = ctx.knowledge_base
  const systemPrompt = buildPrompt5Momentos({
    estado,
    condicionNombre:      ctx.campana.condicion?.nombre ?? 'bienestar general',
    socioNombre,
    paisNombre:           ctx.campana.pais.nombre,
    productosTexto,
    kbPreguntas:          kb?.preguntas_json          ?? null,
    kbSintomas:           kb?.sintomas_json            ?? null,
    kbObjeciones:         kb?.objeciones_json          ?? null,
    kbLenguajeProhibido:  kb?.lenguaje_prohibido_json  ?? null,
    kbProtocolo:          kb?.protocolo_derivacion     ?? null,
    identityInstructions,
    bloqueHistorial,
    bloqueAfiliacion,
    contextoSemantico,
    sociosActivos,
    requiereCita:         ctx.campana.requiere_cita,
  })

  // ─── 13. Activar servicios por señales previas ────────────────────────────
  if (ultimoAsistente.includes(SIGNALS.LISTO_CIERRE) && prospecto_id) {
    activarSwitchCierre(prospecto_id, contextoLead?.resumen ?? null).catch(() => {})
  }
  if (ultimoAsistente.includes(SIGNALS.AFIL_LISTA) && prospecto_id && identidad) {
    iniciarFlujoAfiliacion(
      prospecto_id,
      identidad,
      ctx.campana.condicion?.nombre ?? 'el programa',
    ).catch(() => {})
  }

  // ─── 14. Streaming ────────────────────────────────────────────────────────
  // Normalizar mensajes para el LLM:
  // - M1 (vacío): mensaje sintético de arranque
  // - Si la conversación empieza con assistant (M1 ya respondió): insertar 'inicio' al principio
  let messagesForLLM: Array<{ role: 'user' | 'assistant'; content: string }>

  if (messages.length === 0) {
    messagesForLLM = [{ role: 'user', content: 'inicio' }]
  } else {
    const mapped = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    // Los modelos requieren que el primer mensaje sea del usuario
    if (mapped[0]?.role === 'assistant') {
      messagesForLLM = [{ role: 'user', content: 'inicio' }, ...mapped]
    } else {
      messagesForLLM = mapped
    }
  }

  const result = streamText({
    model:           chatModel,
    system:          systemPrompt,
    messages:        messagesForLLM,
    maxOutputTokens: 600,
    temperature:     fase === 'afiliacion' ? 0.2 : 0.3,
    onFinish: async ({ text }) => {
      if (!prospecto_id) return

      // Fallback server-side: si el LLM no emitió la señal del momento actual,
      // la añadimos aquí para garantizar que el Kanban siempre se mueva.
      // M5b es especial: solo emite INTERES_NEG si el último mensaje del usuario
      // muestra interés en la oportunidad de negocio (detección por keywords).
      let señalFallback: string | undefined

      switch (estado.momento) {
        case 'M3':
          señalFallback = SIGNALS.M3_OK
          break
        case 'M5a':
          señalFallback = SIGNALS.M5A_OK
          break
        case 'M5b': {
          const ultimoUser = messagesForLLM
            .filter(m => m.role === 'user').slice(-1)[0]?.content ?? ''
          const muestraInteres = /ingreso|ganar|dinero|negocio|recomendar|oportunidad|plan|cómo.*gan/i
            .test(ultimoUser)
          if (muestraInteres) señalFallback = SIGNALS.INTERES_NEG
          break
        }
        case 'M6':
          señalFallback = SIGNALS.M6_OK + '\n' + SIGNALS.INTERES_NEG
          break
        case 'M7':
          señalFallback = SIGNALS.M7_OK + '\n' + SIGNALS.AFIL_LISTA
          break
      }

      const textoProcesado = (señalFallback && !text.includes(señalFallback.split('\n')[0]))
        ? text + '\n' + señalFallback
        : text

      // Procesar señales → mover Kanban
      await procesarSeñales(textoProcesado, prospecto_id, {
        nombre:   datosProspecto?.nombre,
        correo:   datosProspecto?.email,
        telefono: datosProspecto?.telefono,
      })

      // Señales de cierre y afiliación
      if (textoProcesado.includes(SIGNALS.LISTO_CIERRE)) {
        await activarSwitchCierre(prospecto_id, contextoLead?.resumen ?? null).catch(() => {})
      }
      if (textoProcesado.includes(SIGNALS.AFIL_LISTA) && identidad) {
        await iniciarFlujoAfiliacion(
          prospecto_id,
          identidad,
          ctx.campana.condicion?.nombre ?? 'el programa',
        ).catch(() => {})
      }
    },
  })

  // Devolver prospecto_id en header para que el frontend lo persista
  const response = result.toTextStreamResponse()
  if (prospecto_id) {
    response.headers.set('X-Prospecto-Id', prospecto_id)
  }
  return response
}
