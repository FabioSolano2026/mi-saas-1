'use client'

/**
 * BannerAuditoria — Banner persistente durante sesión de suplantación.
 *
 * Se monta en el layout principal. Solo es visible cuando existe
 * la clave 'audit_session' en localStorage.
 *
 * Usa localStorage (en vez de sessionStorage) para que el estado persista
 * al refrescar la página dentro de la sesión de auditoría.
 *
 * Al "Finalizar Auditoría":
 *  1. Cierra la sesión suplantada (signOut)
 *  2. Restaura la sesión original del admin con el par access+refresh guardado
 *  3. Elimina la clave de localStorage
 *  4. Redirige a /admin
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter }                        from 'next/navigation'
import { ShieldAlert, X, Loader2 }          from 'lucide-react'
import { createClient }                     from '@/lib/supabase/client'

interface AuditSession {
  adminAccessToken:  string
  adminRefreshToken: string
  socioNombre:       string
  socioId:           string
}

export const AUDIT_KEY = 'audit_session'

// ─── Banner ────────────────────────────────────────────────────────────────────

export function BannerAuditoria() {
  const router                  = useRouter()
  const [sesion,   setSesion]   = useState<AuditSession | null>(null)
  const [saliendo, setSaliendo] = useState(false)

  // Leer localStorage en mount (client-only — no existe en SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUDIT_KEY)
      if (raw) setSesion(JSON.parse(raw) as AuditSession)
    } catch {
      localStorage.removeItem(AUDIT_KEY)
    }
  }, [])

  const finalizarAuditoria = useCallback(async () => {
    if (!sesion || saliendo) return
    setSaliendo(true)

    try {
      const supabase = createClient()

      // 1. Cerrar sesión del socio suplantado
      await supabase.auth.signOut()

      // 2. Restaurar sesión admin
      await supabase.auth.setSession({
        access_token:  sesion.adminAccessToken,
        refresh_token: sesion.adminRefreshToken,
      })

      // 3. Limpiar flag de auditoría
      localStorage.removeItem(AUDIT_KEY)
      setSesion(null)

      // 4. Volver al panel admin
      router.push('/admin')
      router.refresh()
    } catch {
      // Restauración falló: limpiar y redirigir a login
      localStorage.removeItem(AUDIT_KEY)
      router.push('/login')
    } finally {
      setSaliendo(false)
    }
  }, [sesion, saliendo, router])

  if (!sesion) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 w-full bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg"
    >
      {/* Ícono + texto */}
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide truncate">
          Auditando sesión de:{' '}
          <span className="normal-case font-extrabold">{sesion.socioNombre}</span>
        </span>
      </div>

      {/* Botón Finalizar */}
      <button
        onClick={finalizarAuditoria}
        disabled={saliendo}
        className="flex items-center gap-1.5 text-xs font-bold bg-white text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saliendo
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <X       className="w-3.5 h-3.5" />
        }
        Finalizar Auditoría
      </button>
    </div>
  )
}

// ─── Utilidad para iniciar suplantación (usada por BotonSuplantar) ─────────────

export async function iniciarSuplantacion(socioId: string): Promise<void> {
  // 1. Llamar al endpoint — verifica rol='admin' en servidor
  const res = await fetch(`/api/admin/suplantar/${socioId}`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Error iniciando suplantación')
  }

  const data = await res.json() as {
    hashed_token: string
    socio:        { id: string; nombre: string }
  }

  // 2. Guardar sesión admin ANTES de reemplazarla
  const supabase = createClient()
  const { data: { session: adminSession } } = await supabase.auth.getSession()
  if (!adminSession) throw new Error('Sesión de administrador no encontrada')

  const auditData: AuditSession = {
    adminAccessToken:  adminSession.access_token,
    adminRefreshToken: adminSession.refresh_token,
    socioNombre:       data.socio.nombre,
    socioId:           data.socio.id,
  }

  // 3. Guardar en localStorage (persiste en refresh)
  localStorage.setItem(AUDIT_KEY, JSON.stringify(auditData))

  // 4. Canjear hashed_token por sesión real del socio
  const { error: signInError } = await supabase.auth.exchangeCodeForSession(data.hashed_token)
  if (signInError) {
    localStorage.removeItem(AUDIT_KEY)
    throw signInError
  }

  // 5. Navegar al dashboard como el socio
  window.location.href = '/dashboard'
}
