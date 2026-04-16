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
print("DIAGNOSTICO COMPLETO DE HOOKS Y TRIGGERS")
print("=" * 60)

# 1. Todos los triggers en auth.users
print("\n[1] Triggers en auth.users:")
result = run_sql("triggers", """
SELECT trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;
""")
try:
    for r in json.loads(result):
        print(f"    {r['trigger_name']} | {r['event_timing'] if 'event_timing' in r else r.get('action_timing','')} {r['event_manipulation']} | {r['action_statement']}")
except: pass

# 2. Cuerpo exacto de handle_new_user
print("\n[2] Cuerpo de handle_new_user:")
result = run_sql("handle_new_user body", """
SELECT prosrc
FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
WHERE pg_namespace.nspname = 'public'
  AND proname = 'handle_new_user';
""")
try:
    rows = json.loads(result)
    if rows:
        print(rows[0]['prosrc'])
except: pass

# 3. Cuerpo de custom_access_token_hook
print("\n[3] Cuerpo de custom_access_token_hook:")
result = run_sql("custom_access_token_hook body", """
SELECT prosrc
FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
WHERE pg_namespace.nspname = 'public'
  AND proname = 'custom_access_token_hook';
""")
try:
    rows = json.loads(result)
    if rows:
        print(rows[0]['prosrc'])
except: pass

# 4. Verificar datos existentes: cuantos tenants y socios hay
print("\n[4] Datos actuales en BD:")
result = run_sql("count tenants", "SELECT count(*) as total FROM public.tenants;")
try:
    print(f"    tenants: {json.loads(result)[0]['total']}")
except: pass

result = run_sql("count socios", "SELECT count(*) as total FROM public.socios;")
try:
    print(f"    socios:  {json.loads(result)[0]['total']}")
except: pass

result = run_sql("count auth.users", "SELECT count(*) as total FROM auth.users;")
try:
    print(f"    auth.users: {json.loads(result)[0]['total']}")
except: pass

print("\n[5] Hooks configurados via supabase_functions (auth hooks del dashboard):")
result = run_sql("auth hooks config", """
SELECT * FROM auth.hooks LIMIT 10;
""")
try:
    rows = json.loads(result)
    if rows:
        for r in rows:
            print(f"    {r}")
    else:
        print("    tabla auth.hooks vacia o no accesible")
except:
    print("    No accesible via Management API")
