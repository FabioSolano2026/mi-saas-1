import subprocess, json, sys, os

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_query_check.json"
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
        return json.dumps(json.loads(result.stdout.strip()), indent=2)
    except:
        return result.stdout.strip()

out_data = {
    "tenants_columns": run_sql("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants';
"""),
    "socios_columns": run_sql("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'socios';
""")
}

with open('auth_debug2.json', 'w', encoding='utf-8') as f:
    f.write(json.dumps(out_data, indent=2))


