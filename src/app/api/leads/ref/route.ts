/**
 * GET /api/leads/ref?slug=mi-slug
 *
 * Resuelve un slug de afiliado y devuelve el contexto del socio + campaña.
 * Endpoint público — usado por la landing page para cargar el contexto.
 */
import { NextResponse }      from 'next/server'
import { resolveRefParam }   from '@/features/leads/services/lead.service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug requerido' }, { status: 400 })
  }

  const contexto = await resolveRefParam(slug)

  if (!contexto) {
    return NextResponse.json({ error: 'Link no encontrado o inactivo' }, { status: 404 })
  }

  return NextResponse.json(contexto)
}
