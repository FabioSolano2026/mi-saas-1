import { createServerClient } from '@supabase/ssr'
import type { CookieMethodsServer } from '@supabase/ssr/dist/main/types'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // Ignore en Server Components (lectura sin respuesta)
      }
    },
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods }
  )

  return client as unknown as SupabaseClient<Database>
}
