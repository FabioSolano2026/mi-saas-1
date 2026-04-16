import subprocess, json, sys, os

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_test_hook.json"
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

# Usar el ID del usuario rqfabiosolano@gmail.com que encontramos en diagnosis_results.json
user_id = "5fae190f-29a0-423b-b796-bae351f66b3d"

print(f"--- Probando hook para el usuario {user_id} ---")
test_sql = f"""
SELECT public.custom_access_token_hook(
    jsonb_build_object(
        'user_id', '{user_id}',
        'claims', '{{}}'::jsonb
    )
) as result;
"""

res = run_sql(test_sql)
print(json.dumps(res, indent=2))
