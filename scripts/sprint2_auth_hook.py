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
        print(f"  RAW {label}: {out[:200]}")
    return out

print("=" * 60)
print("SPRINT 2.1 — AUTH HOOK")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# 1. Función auth.custom_access_token_hook
#    Lee tenant_id de socios y lo inyecta en el JWT
# ─────────────────────────────────────────────────────────────
run_sql("custom_access_token_hook function", """
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tenant_id  uuid;
  v_claims     jsonb;
BEGIN
  -- Leer el tenant_id del socio que está haciendo login
  SELECT tenant_id INTO v_tenant_id
  FROM public.socios
  WHERE usuario_id = (event ->> 'user_id')::uuid;

  -- Si encontramos tenant_id, inyectarlo en los claims
  IF v_tenant_id IS NOT NULL THEN
    v_claims := event -> 'claims';
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
    event    := jsonb_set(event,    '{claims}',    v_claims);
  END IF;

  RETURN event;
END;
$$;
""")

# ─────────────────────────────────────────────────────────────
# 2. Permisos: supabase_auth_admin puede ejecutar el hook
# ─────────────────────────────────────────────────────────────
run_sql("grant execute to supabase_auth_admin", """
GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO supabase_auth_admin;
""")

run_sql("revoke execute from authenticated anon", """
REVOKE EXECUTE ON FUNCTION auth.custom_access_token_hook FROM authenticated, anon, public;
""")

# ─────────────────────────────────────────────────────────────
# 3. supabase_auth_admin necesita SELECT en socios
# ─────────────────────────────────────────────────────────────
run_sql("grant select on socios to supabase_auth_admin", """
GRANT SELECT ON TABLE public.socios TO supabase_auth_admin;
""")

# ─────────────────────────────────────────────────────────────
# 4. Verificar que la función existe
# ─────────────────────────────────────────────────────────────
print("\n--- Verificacion ---")
result = run_sql("verify hook function exists", """
SELECT
  routine_schema,
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
  AND routine_name   = 'custom_access_token_hook';
""")

try:
    rows = json.loads(result)
    if rows:
        print(f"  Funcion encontrada: {rows[0]}")
    else:
        print("  ADVERTENCIA: funcion no encontrada en information_schema")
except:
    pass

print()
print("LISTO. Ahora ve a Supabase Dashboard:")
print("  Authentication -> Hooks")
print("  Custom Access Token -> Habilitar -> auth.custom_access_token_hook")
print()
print("Sin ese paso manual el hook NO se activa.")
