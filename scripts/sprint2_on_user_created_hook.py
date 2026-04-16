import subprocess, json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(label, sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_query.json"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", API,
         "-H", f"Authorization: Bearer {PAT}",
         "-H", "Content-Type: application/json",
         "--data-binary", f"@{tmp}"],
        capture_output=True, text=True
    )
    os.remove(tmp)
    out = result.stdout.strip()
    try:
        parsed = json.loads(out)
        if isinstance(parsed, list) or (isinstance(parsed, dict) and "message" not in parsed):
            print(f"  OK  {label}")
        else:
            print(f"  ERR {label}: {parsed}")
    except:
        print(f"  RAW {label}: {out[:300]}")
    return out

print("=" * 60)
print("AUTH HOOK — on_auth_user_created")
print("Crea tenant propio + perfil socio en un solo INSERT atomico")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# Función principal: public.handle_new_user()
# Evento: AFTER INSERT en auth.users (hook on_auth_user_created)
#
# Flujo:
#   1. Genera un nuevo tenant_id
#   2. INSERT en public.tenants  (nombre derivado del email)
#   3. INSERT en public.socios   (vincula usuario_id al nuevo tenant)
#
# Columnas reales verificadas contra types.ts:
#   tenants: tenant_id, nombre, plan, activo, requiere_cita
#   socios:  usuario_id, tenant_id, correo, nombre_completo, estado, tier
# ─────────────────────────────────────────────────────────────
run_sql("create handle_new_user function", """
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid := gen_random_uuid();
  v_nombre      text;
  v_email       text;
BEGIN
  -- Extraer email del nuevo usuario
  v_email := NEW.email;

  -- Derivar nombre del tenant del email (parte antes del @)
  v_nombre := split_part(v_email, '@', 1);

  -- 1. Crear el tenant propio del socio
  INSERT INTO public.tenants (
    tenant_id,
    nombre,
    plan,
    activo,
    requiere_cita
  ) VALUES (
    v_tenant_id,
    v_nombre,
    'starter',
    true,
    false
  );

  -- 2. Crear el perfil del socio vinculado al nuevo tenant
  INSERT INTO public.socios (
    usuario_id,
    tenant_id,
    correo,
    nombre_completo,
    estado,
    tier
  ) VALUES (
    NEW.id,
    v_tenant_id,
    v_email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(v_email, '@', 1)
    ),
    'activo',
    'free'   -- CORREGIDO: 'starter' viola el CHECK constraint de socios.tier
  );

  RETURN NEW;
END;
$$;
""")

# ─────────────────────────────────────────────────────────────
# Trigger en auth.users
# Nota: el Management API no puede crear triggers en schema auth.
# Este trigger se activa via el Auth Hook de Supabase Dashboard.
# Solo necesitamos la función — Supabase la llama internamente.
# ─────────────────────────────────────────────────────────────
run_sql("grant execute to supabase_auth_admin", """
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
""")

run_sql("revoke execute from anon authenticated", """
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
""")

# supabase_auth_admin necesita INSERT en tenants y socios
run_sql("grant insert on tenants to supabase_auth_admin", """
GRANT INSERT ON TABLE public.tenants TO supabase_auth_admin;
""")

run_sql("grant insert on socios to supabase_auth_admin", """
GRANT INSERT ON TABLE public.socios TO supabase_auth_admin;
""")

# ─────────────────────────────────────────────────────────────
# Verificar que la funcion existe
# ─────────────────────────────────────────────────────────────
print()
print("--- Verificacion ---")
result = run_sql("verify handle_new_user exists", """
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';
""")
try:
    rows = json.loads(result)
    if rows:
        print(f"  Funcion encontrada: {rows}")
    else:
        print("  ADVERTENCIA: funcion no encontrada")
except:
    pass

print()
print("=" * 60)
print("PASO MANUAL EN SUPABASE DASHBOARD:")
print()
print("  Authentication -> Hooks")
print("  'Create a user' (on_auth_user_created)")
print("  -> Enable Hook")
print("  -> Schema: public")
print("  -> Function: handle_new_user")
print()
print("IMPORTANTE: Este hook es DIFERENTE al 'Custom Access Token'.")
print("Ambos deben estar activos:")
print("  1. handle_new_user        -> crea tenant al registrarse")
print("  2. custom_access_token_hook -> inyecta tenant_id en el JWT al loguearse")
print("=" * 60)
