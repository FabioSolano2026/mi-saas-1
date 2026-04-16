'use client'

import { useState, useCallback } from 'react'
import { CatalogoCampanas }  from '@/features/dashboard/components/CatalogoCampanas'
import { KanbanLeads }       from '@/features/dashboard/components/KanbanLeads'
import { LeadQuickAdd }      from '@/features/dashboard/components/LeadQuickAdd'
import { BulkImport }        from '@/features/dashboard/components/BulkImport'
import { AlertaTimbre }      from '@/features/dashboard/components/AlertaTimbre'
import type { CampanaConEstado } from '@/features/dashboard/types/dashboard.types'

export default function DashboardPage() {
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<CampanaConEstado | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleLeadsActualizados = useCallback(() => setRefreshKey(k => k + 1), [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Mi Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestiona tus campañas y visualiza tus leads.</p>
          </div>
          <BulkImport
            campanaId={campanaSeleccionada?.campana_id ?? null}
            campanaNombre={campanaSeleccionada?.nombre ?? 'Sin campaña'}
            onImportado={handleLeadsActualizados}
          />
        </div>

        {/* Layout: sidebar catálogo + tablero kanban */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Catálogo — sidebar en desktop, card en mobile */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <CatalogoCampanas
                onSeleccionar={setCampanaSeleccionada}
                campanaSeleccionadaId={campanaSeleccionada?.campana_id ?? null}
              />
            </div>
          </div>

          {/* Kanban leads */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden">
            <KanbanLeads
              key={refreshKey}
              campanaId={campanaSeleccionada?.campana_id ?? null}
              campanaNombre={campanaSeleccionada?.nombre ?? ''}
            />
          </div>

        </div>
      </div>

      {/* Alerta de Timbre — cierre en tiempo real */}
      <AlertaTimbre habilitado={!!campanaSeleccionada} />

      {/* Floating add button */}
      <LeadQuickAdd
        campanaId={campanaSeleccionada?.campana_id ?? null}
        campanaNombre={campanaSeleccionada?.nombre ?? 'Sin campaña'}
        onCreado={handleLeadsActualizados}
      />
    </div>
  )
}
