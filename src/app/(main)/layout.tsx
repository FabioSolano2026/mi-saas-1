import { NavBar }          from '@/features/dashboard/components/NavBar'
import { BannerAuditoria } from '@/features/dashboard/components/BannerAuditoria'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Banner de auditoría — solo visible cuando hay sesión de suplantación activa */}
      <BannerAuditoria />
      <NavBar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
