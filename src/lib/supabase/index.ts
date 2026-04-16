/**
 * src/lib/supabase/index.ts
 *
 * Singleton de Supabase para uso server-side:
 *   - Tests de integración y unit tests (vi.spyOn)
 *   - Scripts de servidor y utilities que no corren en browser
 *
 * NO usar en componentes 'use client' — para eso está client.ts.
 * NO usar en API Routes — para eso está server.ts (que maneja cookies SSR).
 *
 * Prioridad de credenciales:
 *   1. SUPABASE_SERVICE_ROLE_KEY (tests de integración, bypassa RLS)
 *   2. NEXT_PUBLIC_SUPABASE_ANON_KEY (fallback, sujeto a RLS)
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''

if (!url || !key) {
  console.warn(
    '[supabase/index] NEXT_PUBLIC_SUPABASE_URL o las keys no están definidas. ' +
    'Los tests de integración fallarán. Verifica .env.local.'
  )
}

export const supabase = createClient<Database>(url, key)
