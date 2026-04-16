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
print("SPRINT 2 — RLS POLICIES FALTANTES")
print("=" * 60)

# ── notificaciones: el socio puede marcar sus propias como enviadas ──
run_sql("notificaciones: UPDATE policy para socio", """
CREATE POLICY notif_update_propio ON notificaciones
  FOR UPDATE
  USING (socio_id = auth.uid())
  WITH CHECK (socio_id = auth.uid());
""")

# ── campanas: el socio puede crear campañas en su tenant ──
run_sql("campanas: INSERT policy para socio", """
CREATE POLICY campanas_insert_propio ON campanas
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND socio_id = auth.uid()
  );
""")

# ── campanas: el socio puede actualizar sus propias campañas ──
run_sql("campanas: UPDATE policy para socio", """
CREATE POLICY campanas_update_propio ON campanas
  FOR UPDATE
  USING (socio_id = auth.uid())
  WITH CHECK (socio_id = auth.uid());
""")

# ── prospectos: el socio puede insertar nuevos prospectos en su tenant ──
run_sql("prospectos: INSERT policy para agente", """
CREATE POLICY prospectos_insert_agente ON prospectos
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
""")

# ── prospectos: UPDATE para mover en kanban ──
run_sql("prospectos: UPDATE policy para socio", """
CREATE POLICY prospectos_update_propio ON prospectos
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
""")

print()
print("Listo. Regenerando tipos TypeScript...")
