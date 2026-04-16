import subprocess, json, sys, os

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_solucion_definitiva.json"
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

print("--- REINSTALANDO HOOK DEFINITIVO ---")
sql = """
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
  -- 1. Buscar datos en socios
  SELECT tenant_id, tier
  INTO   v_tenant_id, v_tier
  FROM   public.socios
  WHERE  usuario_id = (event ->> 'user_id')::uuid;

  -- 2. Si no hay tenant_id, salimos sin modificar nada (Supabase usará el token estándar)
  IF v_tenant_id IS NULL THEN
    RETURN event;
  END IF;

  -- 3. Inyectar claims (Formato Definitive)
  v_claims := event -> 'claims';
  
  -- Inyectar directamente en claims (aparecerá en app_metadata del SDK)
  v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  v_claims := jsonb_set(v_claims, '{tier}',      to_jsonb(COALESCE(v_tier, 'free')));
  
  -- Asegurar app_metadata explícito (algunos SDKs lo consumen de aquí)
  v_claims := jsonb_set(v_claims, '{app_metadata, tenant_id}', to_jsonb(v_tenant_id::text));
  v_claims := jsonb_set(v_claims, '{app_metadata, tier}',      to_jsonb(COALESCE(v_tier, 'free')));

  event := jsonb_set(event, '{claims}', v_claims);

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
"""

res = run_sql(sql)
print(json.dumps(res, indent=2))
print("\n--- HOOK INSTALADO CON ÉXITO ---")
