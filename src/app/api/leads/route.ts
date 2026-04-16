/**
 * POST /api/leads
 *
 * Captura un lead desde la landing page y lo registra como prospecto
 * asociado al socio correspondiente al ref_slug.
 */
import { NextResponse }    from 'next/server'
import { z }               from 'zod'
import { resolveRefParam, capturarLead } from '@/features/leads/services/lead.service'

const LeadSchema = z.object({
  nombre:   z.string().min(2).max(100),
  email:    z.string().email(),
  telefono: z.string().min(7).max(20),
  ref_slug: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const body   = await request.json()
  const parsed = LeadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { nombre, email, telefono, ref_slug } = parsed.data

  // Resolver el afiliado por slug
  const contexto = await resolveRefParam(ref_slug)
  if (!contexto) {
    return NextResponse.json({ error: 'Referido no encontrado' }, { status: 404 })
  }

  try {
    const prospecto_id = await capturarLead({
      nombre,
      email,
      telefono,
      ref_slug,
      socio_id:   contexto.socio_id,
      campana_id: contexto.campana_id,
      tenant_id:  contexto.tenant_id,
    })

    return NextResponse.json({ prospecto_id }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
