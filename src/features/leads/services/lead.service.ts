import { createClient }                          from '@supabase/supabase-js'
import type { Database }                         from '@/lib/supabase/types'
import type { AfiliadoContexto, LeadCapturado }  from '../types/lead.types'

// Cliente admin — landing page es pública, sin JWT de socio
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Helpers de acceso a RPC no tipadas aún ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (supabaseAdmin as any).rpc.bind(supabaseAdmin)

// ─── Resolver por id_corto (links cortos: /c/abc1234) ────────────────────────

export async function resolveIdCorto(
  id_corto: string | undefined
): Promise<AfiliadoContexto | null> {
  if (!id_corto) return null

  const { data, error } = await rpc('get_contexto_afiliado', { p_id_corto: id_corto })
  if (error || !data) return null
  return data as unknown as AfiliadoContexto
}

// ─── Resolver por slug largo (backwards-compat: /?ref=slug) ─────────────────

export async function resolveRefParam(
  ref: string | string[] | undefined
): Promise<AfiliadoContexto | null> {
  const slug = Array.isArray(ref) ? ref[0] : ref
  if (!slug) return null

  const { data, error } = await rpc('get_socio_by_slug', { p_slug: slug })
  if (error || !data) return null
  return data as unknown as AfiliadoContexto
}

// ─── Capturar lead ───────────────────────────────────────────────────────────

export async function capturarLead(lead: LeadCapturado): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('prospectos')
    .insert({
      tenant_id:         lead.tenant_id,
      socio_id:          lead.socio_id,
      campana_id:        lead.campana_id,
      nombre:            lead.nombre,
      email:             lead.email,
      telefono:          lead.telefono,
      columna_kanban:    'nuevo_prospecto',
      temperatura:       'frio',
      origen:            `ref:${lead.ref_slug}`,
      dias_sin_contacto: 0,
    })
    .select('prospecto_id')
    .single()

  if (error) throw new Error(`Error al capturar lead: ${error.message}`)
  return data.prospecto_id
}
