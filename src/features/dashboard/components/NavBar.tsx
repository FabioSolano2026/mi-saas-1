'use client'

/**
 * NavBar — Barra de navegación principal
 *
 * Links adaptativos según rol:
 *  - Todos los socios: Dashboard, Mi Perfil, Auditoría
 *  - Auditores:        + Admin
 *
 * Detecta ruta activa con usePathname.
 * Carga nombre y rol del socio en mount vía /api/socio/perfil.
 */

import { useEffect, useState }         from 'react'
import { usePathname, useRouter }       from 'next/navigation'
import Link                             from 'next/link'
import {
  LayoutDashboard, UserCircle, Mic2, ClipboardList,
  ShieldCheck, LogOut, ChevronDown, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href:       string
  label:      string
  Icon:       React.ElementType
  soloAdmin?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',   Icon: LayoutDashboard },
  { href: '/perfil',     label: 'Mi Perfil',   Icon: UserCircle      },
  { href: '/auditoria',  label: 'Auditoría',   Icon: ClipboardList   },
  { href: '/admin',      label: 'Admin',        Icon: ShieldCheck, soloAdmin: true },
]

export function NavBar() {
  const pathname            = usePathname()
  const router              = useRouter()
  const [nombre,   setNombre]  = useState<string>('')
  const [rol,      setRol]     = useState<'socio' | 'auditor' | 'admin'>('socio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [signing,  setSigning]  = useState(false)

  useEffect(() => {
    fetch('/api/socio/perfil')
      .then(r => r.ok ? r.json() : null)
      .then((d: { nombre?: string; rol?: string } | null) => {
        if (!d) return
        setNombre(d.nombre ?? '')
        setRol((d.rol ?? 'socio') as 'socio' | 'auditor' | 'admin')
      })
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = NAV_ITEMS.filter(i => !i.soloAdmin || rol !== 'socio')

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 h-14 flex items-center px-4 lg:px-6 gap-4">

      {/* Logotipo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
          <Mic2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900 hidden sm:block">AgenteVoz</span>
      </Link>

      {/* Nav links — desktop */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User menu — desktop */}
      <div className="hidden md:flex items-center gap-2 ml-auto">
        {nombre && (
          <span className="text-xs text-gray-500 font-medium max-w-[140px] truncate">
            {nombre}
          </span>
        )}
        {rol === 'admin' && (
          <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
            Admin
          </span>
        )}
        {rol === 'auditor' && (
          <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
            Auditor
          </span>
        )}
        <button
          onClick={handleSignOut}
          disabled={signing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
        >
          {signing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <LogOut  className="w-3.5 h-3.5" />
          }
          <span className="hidden lg:inline">Salir</span>
        </button>
      </div>

      {/* Hamburger — mobile */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="md:hidden ml-auto flex items-center gap-1 text-xs text-gray-500 font-semibold"
      >
        Menú
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="absolute top-14 left-0 right-0 bg-white border-b border-gray-100 shadow-lg z-50 px-4 py-3 flex flex-col gap-1 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
          <hr className="my-1 border-gray-100" />
          <button
            onClick={handleSignOut}
            disabled={signing}
            className="flex items-center gap-2 text-sm text-red-500 font-semibold px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  )
}
