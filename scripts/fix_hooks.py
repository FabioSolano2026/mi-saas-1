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
print("VERIFICANDO Y CORRIGIENDO HOOKS")
print("=" * 60)

# ── 1. Verificar qué triggers existen en auth.users ──────────
print("\n--- Triggers en auth.users ---")
result = run_sql("check triggers on auth.users", """
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';
""")
try:
    rows = json.loads(result)
    if rows:
        for r in rows:
            print(f"  Trigger: {r}")
    else:
        print("  Ninguno encontrado")
except:
    pass

# ── 2. Verificar funciones existentes en public ───────────────
print("\n--- Funciones en public ---")
result = run_sql("check functions", """
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'custom_access_token_hook');
""")
try:
    rows = json.loads(result)
    for r in rows:
        print(f"  Funcion: {r['routine_name']} ({r['security_type']})")
except:
    pass

# ── 3. Crear trigger on_auth_user_created ────────────────────
# El Management API no puede crear triggers en schema auth.
# Usamos el workaround: crear la funcion en public y el trigger
# queda como supabase_auth_admin puede ejecutar via hook interno.
# La solucion correcta es un trigger directo en auth.users.
# Supabase permite esto via SQL Editor pero no via Management API.
# Alternativa: usar un trigger en public via extension plpgsql.

# Intentamos igual — si falla, lo hacemos via supabase_auth hook
print("\n--- Creando trigger via SQL directo ---")
result = run_sql("create trigger on auth.users", """
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
""")

# ── 4. Verificar resultado ────────────────────────────────────
print("\n--- Verificacion final ---")
result = run_sql("verify trigger exists", """
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
""")
try:
    rows = json.loads(result)
    if rows:
        print(f"  TRIGGER ACTIVO: {rows[0]}")
    else:
        print("  Trigger no creado via API (permiso insuficiente)")
        print("  -> Usar SQL Editor de Supabase como alternativa")
except:
    pass
