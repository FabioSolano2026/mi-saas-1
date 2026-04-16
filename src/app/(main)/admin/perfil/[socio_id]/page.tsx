/**
 * /admin/perfil/[socio_id] — Revisión de identidad de un socio específico.
 *
 * Auditor puede:
 *  - Aprobar/rechazar voz clonada y avatar
 *  - Escuchar y aprobar/rechazar cada frase grabada
 *  - Dejar notas para el socio
 */

import { AdminPerfilSocio } from '@/features/dashboard/components/AdminPerfilSocio'

export default async function AdminPerfilPage({
  params,
}: {
  params: Promise<{ socio_id: string }>
}) {
  const { socio_id } = await params

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <AdminPerfilSocio socioId={socio_id} />
      </div>
    </div>
  )
}
