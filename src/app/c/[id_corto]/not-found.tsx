export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="text-4xl font-bold text-gray-200">404</p>
        <h1 className="text-base font-semibold text-gray-600">Link no encontrado</h1>
        <p className="text-sm text-gray-400">Este link ya no está activo o no existe.</p>
      </div>
    </div>
  )
}
