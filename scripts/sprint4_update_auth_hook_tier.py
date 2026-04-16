"""
sprint4_update_auth_hook_tier.py

Actualiza custom_access_token_hook para inyectar también `tier` de socios
en el JWT. Esto permite que las API Routes y el middleware lean el tier
sin hacer una query extra a la BD en cada request.

Antes:  JWT claims = { tenant_id }
Después: JWT claims = { tenant_id, tier }
"""

import subprocess, json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(label, sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_hook_update.json"
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
    except Exception:
        print(f"  RAW {label}: {out[:300]}")
    return out

print("=" * 60)
print("  ACTUALIZAR AUTH HOOK — inyectar tier en JWT")
print("=" * 60)

run_sql("actualizar custom_access_token_hook (+ tier)", """
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id  uuid;
  v_tier       text;
  v_claims     jsonb;
BEGIN
  SELECT tenant_id, tier
  INTO   v_tenant_id, v_tier
  FROM   public.socios
  WHERE  usuario_id = (event ->> 'user_id')::uuid;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := event -> 'claims';
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
    v_claims := jsonb_set(v_claims, '{tier}',      to_jsonb(COALESCE(v_tier, 'free')));
    event    := jsonb_set(event,    '{claims}',    v_claims);
  END IF;

  RETURN event;
END;
$$;
""")

# Verificar
out = run_sql("verificar hook actualizado", """
SELECT prosrc FROM pg_proc WHERE proname = 'custom_access_token_hook'
""")
try:
    rows = json.loads(out)
    src = rows[0].get('prosrc','') if rows else ''
    tiene_tier = 'tier' in src
    print(f"     tier inyectado en JWT: {'SI' if tiene_tier else 'NO'}")
except Exception:
    print(f"  RAW: {out[:200]}")

print("=" * 60 + "\n")
