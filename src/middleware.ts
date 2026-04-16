import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Log mínimo — solo ID (nunca email ni objeto completo en producción)
  if (user && process.env.NODE_ENV !== 'production') {
    console.log(`[Middleware] ${user.id.slice(0, 8)}… -> ${pathname}`)
    if (!user.app_metadata?.tenant_id && !user.user_metadata?.tenant_id) {
      console.warn(`[Middleware] WARN: sin tenant_id para ${user.id.slice(0, 8)}…`)
    }
  }

  // --- PROTECCIÓN DE RUTAS ---

  const rutasProtegidas = pathname.startsWith('/dashboard') || pathname.startsWith('/auditoria')

  // Proteger rutas principales — redirigir a login si no hay sesión
  if (rutasProtegidas) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Si tiene sesión pero no completó onboarding → redirigir (excepto si ya va a /onboarding)
    if (!pathname.startsWith('/onboarding')) {
      const onboardingOk = user.app_metadata?.onboarding_ok ??
                           user.user_metadata?.onboarding_ok
      // Solo redirigimos si el claim está explícitamente en false
      // (undefined = aún no conocemos el estado, dejamos pasar para evitar loops)
      if (onboardingOk === false) {
        const onbUrl = request.nextUrl.clone()
        onbUrl.pathname = '/onboarding'
        return NextResponse.redirect(onbUrl)
      }
    }
  }

  // Redirigir a /dashboard si ya está autenticado e intenta entrar a /login
  if (pathname === '/login' && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}


export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
