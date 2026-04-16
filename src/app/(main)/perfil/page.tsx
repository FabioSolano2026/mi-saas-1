'use client'

/**
 * /perfil — Motor de Identidad del Socio
 *
 * Tabs:
 *  - Motor de Identidad  → PerfilIdentidad
 *  - Estudio de Voz      → EstudioVoz
 */

import { useState }           from 'react'
import { UserCircle, Mic2 }   from 'lucide-react'
import { PerfilIdentidad }    from '@/features/dashboard/components/PerfilIdentidad'
import { EstudioVoz }         from '@/features/dashboard/components/EstudioVoz'

const TABS = [
  { id: 'identidad', label: 'Motor de Identidad', Icon: UserCircle },
  { id: 'voz',       label: 'Estudio de Voz',     Icon: Mic2       },
] as const
type TabId = typeof TABS[number]['id']

export default function PerfilPage() {
  const [tab, setTab] = useState<TabId>('identidad')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">Mi Perfil de Identidad</h1>
          <p className="text-xs text-gray-400 mt-1">
            Configura cómo el agente te representa y graba tus frases maestras.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg transition-all ${
                tab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'identidad' && <PerfilIdentidad />}
        {tab === 'voz'       && <EstudioVoz />}
      </div>
    </div>
  )
}
