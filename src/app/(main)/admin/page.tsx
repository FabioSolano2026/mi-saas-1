'use client'

/**
 * /admin — Panel de Auditoría (solo auditores)
 *
 * Tabs:
 *  - Validar Identidades  → AdminIdentidades (lista de socios + enlace a detalle)
 *  - Calidad de Audio     → AdminAudiosCalidad (métricas SNR/LUFS por frase)
 */

import { useState }                 from 'react'
import { ShieldCheck, BarChart2 }   from 'lucide-react'
import { AdminIdentidades }         from '@/features/dashboard/components/AdminIdentidades'
import { AdminAudiosCalidad }       from '@/features/dashboard/components/AdminAudiosCalidad'

const TABS = [
  { id: 'identidades', label: 'Validar Identidades', Icon: ShieldCheck },
  { id: 'calidad',     label: 'Calidad de Audio',    Icon: BarChart2   },
] as const
type TabId = typeof TABS[number]['id']

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>('identidades')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-violet-500" />
            <h1 className="text-lg font-bold text-gray-900">Panel de Auditoría</h1>
          </div>
          <p className="text-xs text-gray-400">
            Valida identidades y revisa la calidad técnica de los audios de los socios.
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
        {tab === 'identidades' && <AdminIdentidades />}
        {tab === 'calidad'     && <AdminAudiosCalidad />}
      </div>
    </div>
  )
}
