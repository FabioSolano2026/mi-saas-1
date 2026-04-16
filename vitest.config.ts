/**
 * vitest.config.ts
 *
 * Configuración de Vitest para el proyecto SaaS Multi-Nicho.
 *
 * Dos tipos de tests:
 *   - Unit tests (auditoria.test.ts): sin BD real, usan mocks de Vitest
 *   - Integration tests (audit-kanban.test.ts): requieren SUPABASE_SERVICE_ROLE_KEY
 *     y se saltan automáticamente si la variable no está disponible.
 *
 * Variables de entorno: cargadas desde .env.local via dotenv antes de que
 * Vitest inicie los workers — la misma fuente que usa Next.js en desarrollo.
 */

import { defineConfig } from 'vitest/config'
import { resolve }      from 'path'
import { config }       from 'dotenv'

// Cargar .env.local antes de que Vitest ejecute los tests.
// Equivalente a lo que hace Next.js automáticamente.
config({ path: resolve(__dirname, '.env.local') })

export default defineConfig({
  test: {
    environment: 'node',
    // Solo los archivos en tests/ — nunca los archivos de src/
    include: ['tests/**/*.test.ts'],
    // Timeout generoso para tests de integración con Supabase
    testTimeout: 30_000,
    // Mostrar cada test individualmente en el reporte
    reporters: 'verbose',
  },
  resolve: {
    alias: {
      // El mismo alias @ que define tsconfig.json: @ → ./src
      '@': resolve(__dirname, './src'),
    },
  },
})
