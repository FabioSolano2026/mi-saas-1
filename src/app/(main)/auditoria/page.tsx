import { AuditorDashboard } from '@/features/auditoria/components/AuditorDashboard'

export const metadata = {
  title: 'Auditoría | Mi Nuevo SaaS',
  description: 'Panel de auditoría y ciclo de vida de prospectos',
}

export default function AuditoriaPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <AuditorDashboard />
    </div>
  )
}
