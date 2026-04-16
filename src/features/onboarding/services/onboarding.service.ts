import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient }  from '@supabase/supabase-js'
import type { Database }                      from '@/lib/supabase/types'

const supabaseAdmin = createAdminClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TipoNegocio {
  tipo_negocio_id: string
  nombre:          string
  descripcion:     string | null
  icono:           string | null
}

export interface DatosOnboarding {
  nombre_completo: string
  telefono:        string
  foto_url:        string | null
  tipo_negocio_id: string
}

// ─── Verificar si el socio necesita onboarding ────────────────────────────────

export async function necesitaOnboarding(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('socios')
    .select('onboarding_ok' as never)
    .eq('usuario_id', user.id)
    .single()

  return (data as { onboarding_ok: boolean } | null)?.onboarding_ok === false
}

// ─── Cargar tipos de negocio para el selector ─────────────────────────────────

export async function getTiposNegocio(): Promise<TipoNegocio[]> {
  const { data } = await supabaseAdmin
    .from('tipos_negocio' as never)
    .select('tipo_negocio_id, nombre, descripcion, icono')
    .eq('activo', true)
    .order('nombre')

  return (data as TipoNegocio[] | null) ?? []
}

// ─── Guardar datos de onboarding ─────────────────────────────────────────────

export async function completarOnboarding(
  userId: string,
  datos: DatosOnboarding
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('socios')
    .update({
      nombre_completo:  datos.nombre_completo,
      telefono:         datos.telefono,
      foto_url:         datos.foto_url ?? undefined,
      tipo_negocio_id:  datos.tipo_negocio_id as never,
      onboarding_ok:    true,
      actualizado_en:   new Date().toISOString(),
    } as never)
    .eq('usuario_id', userId)

  if (error) throw new Error(`Error al guardar onboarding: ${error.message}`)
}

// ─── Invitar socio (llama RPC + Admin API para el email) ─────────────────────

export async function invitarSocio(
  email: string,
  tipoNegocioId: string | null,
  redirectTo: string
): Promise<{ invitacion_id: string }> {
  const supabase = await createServerClient()

  // 1. Registrar invitación en BD via RPC
  const { data: inv, error: rpcError } = await supabase.rpc(
    'invitar_socio' as never,
    { p_email: email, p_tipo_negocio_id: tipoNegocioId } as never
  )
  if (rpcError) throw new Error(rpcError.message)

  // 2. Enviar email de invitación via Admin API
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo }
  )
  if (inviteError) throw new Error(`Error al enviar invitación: ${inviteError.message}`)

  return inv as { invitacion_id: string }
}
