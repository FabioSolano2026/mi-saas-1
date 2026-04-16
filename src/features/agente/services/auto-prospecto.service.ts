/**
 * auto-prospecto.service.ts
 *
 * Crea y actualiza prospectos automáticamente durante el flujo del agente.
 *
 * Lógica de ciclo de vida (columnas válidas del CHECK constraint de BD):
 *  - Primer mensaje del usuario → crear prospecto 'nuevo_prospecto'
 *  - [M3_RECOMENDACION_ENTREGADA]          → 'en_seguimiento'
 *  - [INTERES_NEGOCIO]                     → 'propuesta_enviada'
 *  - [LISTO_CIERRE]                        → 'listo_para_cerrar'
 *  - [AFILIACION_LISTA]                    → 'cliente_activo'
 *  - [DATOS_COMPLETOS] con nombre+tel      → guardar datos de contacto
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Crear prospecto anónimo (primer mensaje) ─────────────────────────────────

export async function crearProspectoAnonimo(params: {
  tenant_id:  string
  campana_id: string
  socio_id:   string | null
  pais_id:    string
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('prospectos')
      .insert({
        tenant_id:      params.tenant_id,
        campana_id:     params.campana_id,
        socio_id:       params.socio_id,
        pais_id:        params.pais_id,
        nombre:         'Visitante',
        columna_kanban: 'nuevo_prospecto',
        origen:         'landing_agente',
        canal_agente:   'texto',
        temperatura:    'tibio',
        visible_para_socio: false,
      })
      .select('prospecto_id')
      .single()

    if (error || !data) return null
    return data.prospecto_id as string
  } catch {
    return null
  }
}

// ─── Mover tarjeta Kanban ─────────────────────────────────────────────────────

export async function moverKanban(
  prospecto_id: string,
  columna: string,
  nota?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    columna_kanban:   columna,
    ultimo_contacto:  new Date().toISOString(),
  }
  if (nota) update.nota_agente = nota

  await supabaseAdmin
    .from('prospectos')
    .update(update)
    .eq('prospecto_id', prospecto_id)
}

// ─── Actualizar datos de contacto cuando estén completos ─────────────────────

export async function actualizarDatosContacto(
  prospecto_id: string,
  datos: { nombre?: string; correo?: string; telefono?: string },
): Promise<void> {
  const update: Record<string, unknown> = {
    ultimo_contacto: new Date().toISOString(),
    visible_para_socio: true,
  }
  if (datos.nombre)   update.nombre   = datos.nombre
  if (datos.correo)   update.correo   = datos.correo
  if (datos.telefono) update.telefono = datos.telefono

  await supabaseAdmin
    .from('prospectos')
    .update(update)
    .eq('prospecto_id', prospecto_id)
}

// ─── Detectar y ejecutar transiciones desde señales del texto generado ────────

export async function procesarSeñales(
  texto: string,
  prospecto_id: string,
  datos_prospecto?: { nombre?: string; correo?: string; telefono?: string },
): Promise<void> {
  const promises: Promise<unknown>[] = []

  if (texto.includes('[M3_RECOMENDACION_ENTREGADA]')) {
    promises.push(moverKanban(prospecto_id, 'en_seguimiento', 'Recomendación entregada por el agente'))
  }

  if (texto.includes('[INTERES_NEGOCIO]')) {
    promises.push(moverKanban(prospecto_id, 'propuesta_enviada', 'Prospecto interesado en oportunidad de negocio'))
  }

  if (texto.includes('[LISTO_CIERRE]')) {
    promises.push(moverKanban(prospecto_id, 'listo_para_cerrar', 'Listo para comprar — señal del agente'))
  }

  if (texto.includes('[AFILIACION_LISTA]')) {
    promises.push(moverKanban(prospecto_id, 'cliente_activo', 'Afiliación completada — señal del agente'))
  }

  if (texto.includes('[DATOS_COMPLETOS]') && datos_prospecto) {
    promises.push(actualizarDatosContacto(prospecto_id, datos_prospecto))
  }

  await Promise.allSettled(promises)
}
