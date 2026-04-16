import subprocess, json, sys, os

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_debug_auth.json"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", API,
         "-H", f"Authorization: Bearer {PAT}",
         "-H", "Content-Type: application/json",
         "--data-binary", f"@{tmp}"],
        capture_output=True, text=True
    )
    if os.path.exists(tmp):
        os.remove(tmp)
    try:
        return json.loads(result.stdout.strip())
    except:
        return result.stdout.strip()

data = {
    "socios": run_sql("SELECT * FROM public.socios ORDER BY creado_en DESC LIMIT 10;"),
    "tenants": run_sql("SELECT * FROM public.tenants ORDER BY creado_en DESC LIMIT 10;"),
    "hook_def": run_sql("""
SELECT pg_get_functiondef(f.oid) 
FROM pg_proc f 
JOIN pg_namespace n ON n.oid = f.pronamespace 
WHERE n.nspname = 'public' AND f.proname = 'custom_access_token_hook';
"""),
    "privileges": run_sql("""
SELECT grantee, privilege_type 
FROM information_schema.role_routine_grants 
WHERE routine_name = 'custom_access_token_hook';
""")
}

with open('diagnosis_results.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Done. Results saved to diagnosis_results.json")

