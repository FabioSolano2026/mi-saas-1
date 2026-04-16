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
print("SPRINT 2.1 — AUTH HOOK (schema public)")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# Función en schema PUBLIC (Management API tiene acceso aquí)
# Supabase Dashboard permite especificar public.custom_access_token_hook
# ─────────────────────────────────────────────────────────────
run_sql("create custom_access_token_hook in public", """
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id  uuid;
  v_claims     jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.socios
  WHERE usuario_id = (event ->> 'user_id')::uuid;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := event -> 'claims';
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
    event    := jsonb_set(event,    '{claims}',    v_claims);
  END IF;

  RETURN event;
END;
$$;
""")

run_sql("grant execute to supabase_auth_admin", """
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
""")

run_sql("revoke execute from anon authenticated", """
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon, authenticated;
""")

run_sql("grant select on socios to supabase_auth_admin", """
GRANT SELECT ON TABLE public.socios TO supabase_auth_admin;
""")

# ─────────────────────────────────────────────────────────────
# Verificar
# ─────────────────────────────────────────────────────────────
print("\n--- Verificacion ---")
result = run_sql("verify function exists", """
SELECT routine_schema, routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'custom_access_token_hook';
""")
try:
    rows = json.loads(result)
    if rows:
        print(f"  Funcion: {rows}")
    else:
        print("  ADVERTENCIA: no encontrada")
except:
    pass

print()
print("=" * 60)
print("PASO MANUAL REQUERIDO en Supabase Dashboard:")
print("  Authentication -> Hooks")
print("  'Custom Access Token' -> Enable Hook")
print("  Schema: public")
print("  Function: custom_access_token_hook")
print("=" * 60)
