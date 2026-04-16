/**
 * /c/[id_corto] — Landing page dinámica por link corto
 *
 * Server Component: resuelve el id_corto en el servidor,
 * pasa el contexto al cliente para el formulario de captura.
 */
import { notFound }          from 'next/navigation'
import type { Metadata }     from 'next'
import { resolveIdCorto }    from '@/features/leads/services/lead.service'
import { AfiliadoHeader }    from '@/features/leads/components/AfiliadoHeader'
import { AgenteChat }        from '@/features/leads/components/AgenteChat'

interface Props {
  params: Promise<{ id_corto: string }>
}

// ─── Metadata dinámica ────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id_corto } = await params
  const ctx = await resolveIdCorto(id_corto)
  if (!ctx) return { title: 'Página no encontrada' }

  return {
    title: `${ctx.campana_nombre} — recomendado por ${ctx.nombre_socio}`,
    description: ctx.descripcion_campana ?? ctx.campana_nombre,
    openGraph: {
      title:       `${ctx.campana_nombre}`,
      description: ctx.descripcion_campana ?? '',
      images:      ctx.foto_socio ? [ctx.foto_socio] : [],
    },
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function LandingPage({ params }: Props) {
  const { id_corto } = await params
  const contexto = await resolveIdCorto(id_corto)

  if (!contexto) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header con foto y nombre del socio */}
      <AfiliadoHeader contexto={contexto} />

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col items-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-6">

          {/* Encabezado de la oferta */}
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {contexto.campana_nombre}
            </h2>
            {contexto.descripcion_campana && (
              <p className="text-sm text-gray-500 leading-relaxed">
                {contexto.descripcion_campana}
              </p>
            )}
          </div>

          {/* Agente conversacional — 5 Momentos */}
          <AgenteChat
            campanaId={contexto.campana_id}
            socioNombre={contexto.nombre_socio}
            refSlug={contexto.id_corto}
          />

        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="py-4 text-center">
        <p className="text-[11px] text-gray-300">
          Información compartida por {contexto.nombre_socio}
        </p>
      </footer>

    </div>
  )
}
