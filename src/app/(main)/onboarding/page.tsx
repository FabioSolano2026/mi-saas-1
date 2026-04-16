import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { getTiposNegocio }   from '@/features/onboarding/services/onboarding.service'
import { OnboardingView }    from '@/features/onboarding/components/OnboardingView'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya completó el onboarding, redirigir al dashboard
  const { data: socio } = await supabase
    .from('socios')
    .select('nombre_completo, onboarding_ok' as never)
    .eq('usuario_id', user.id)
    .single()

  const socioData = socio as { nombre_completo: string; onboarding_ok: boolean } | null
  if (socioData?.onboarding_ok) redirect('/dashboard')

  const tiposNegocio = await getTiposNegocio()
  const nombreInicial = socioData?.nombre_completo ?? user.email?.split('@')[0] ?? ''

  return (
    <OnboardingView
      tiposNegocio={tiposNegocio}
      nombreInicial={nombreInicial}
    />
  )
}
