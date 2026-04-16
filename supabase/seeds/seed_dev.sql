-- ═══════════════════════════════════════════════════════════════════
-- SEED DE DESARROLLO — SaaS Multi-Nicho
-- Ejecutar con service_role (bypasa RLS)
-- Idempotente: usa ON CONFLICT DO NOTHING / fixed UUIDs
-- ═══════════════════════════════════════════════════════════════════

-- ─── IDs fijos para idempotencia ─────────────────────────────────────
-- Tenant prueba    : 00000000-0000-0000-0000-000000000002
-- Socio prueba     : 00000000-0000-0000-0000-100000000001 (socio, mismo tenant)
-- Socio auditor    : 00000000-0000-0000-0000-100000000002 (auditor, mismo tenant)
-- Campaña producto : 00000000-0000-0000-0000-200000000001
-- Campaña recluta  : 00000000-0000-0000-0000-200000000002
-- Pais Costa Rica  : 955e8daf-aeb7-41c9-93d4-c928406d80c4
-- Tenant Fabio     : 980c2ba9-5062-42d1-9547-25a8b4471961
-- Socio Fabio      : 5fae190f-29a0-423b-b796-bae351f66b3d

-- ─── 1. TENANT DE PRUEBA ─────────────────────────────────────────────
INSERT INTO tenants (tenant_id, nombre, industria, plan, activo, modulo_activo)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Test Salud Masculina',
  'salud_bienestar',
  'professional',
  true,
  'agente_voz'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ─── 2. SOCIOS DE PRUEBA ─────────────────────────────────────────────

-- Socio estándar (rol = 'socio')
INSERT INTO socios (
  usuario_id, tenant_id, nombre_completo, correo, telefono,
  pais_registro, rol, tier, estado, onboarding_ok
)
VALUES (
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-000000000002',
  'Carlos Méndez (Prueba)',
  'carlos.prueba@test.dev',
  '+50612340001',
  'CR',
  'socio',
  'premium_texto',
  'activo',
  true
)
ON CONFLICT (usuario_id) DO NOTHING;

-- Socio auditor (rol = 'auditor')
INSERT INTO socios (
  usuario_id, tenant_id, nombre_completo, correo, telefono,
  pais_registro, rol, tier, estado, onboarding_ok
)
VALUES (
  '00000000-0000-0000-0000-100000000002',
  '00000000-0000-0000-0000-000000000002',
  'Laura Vega (Auditora Prueba)',
  'laura.auditora@test.dev',
  '+50612340002',
  'CR',
  'auditor',
  'premium_avatar',
  'activo',
  true
)
ON CONFLICT (usuario_id) DO NOTHING;

-- ─── 3. CAMPAÑAS ─────────────────────────────────────────────────────

-- Campaña de producto (en tenant de prueba)
INSERT INTO campanas (
  campana_id, tenant_id, socio_id, pais_id,
  nombre, tipo, modulo_destino, agente_tipo,
  estado, fecha_inicio, requiere_cita
)
VALUES (
  '00000000-0000-0000-0000-200000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'Pack Salud Masculina Total — CR',
  'producto',
  'checkout',
  'texto',
  'activa',
  NOW(),
  false
)
ON CONFLICT (campana_id) DO NOTHING;

-- Campaña de reclutamiento (en tenant de prueba)
INSERT INTO campanas (
  campana_id, tenant_id, socio_id, pais_id,
  nombre, tipo, modulo_destino, agente_tipo,
  estado, fecha_inicio, requiere_cita
)
VALUES (
  '00000000-0000-0000-0000-200000000002',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'Red de Socios Bienestar — CR',
  'reclutamiento',
  'registro_socio',
  'avatar',
  'activa',
  NOW(),
  false
)
ON CONFLICT (campana_id) DO NOTHING;

-- Campaña en tenant de Fabio (para prueba cross-tenant del admin)
INSERT INTO campanas (
  campana_id, tenant_id, socio_id, pais_id,
  nombre, tipo, modulo_destino, agente_tipo,
  estado, fecha_inicio, requiere_cita
)
VALUES (
  '00000000-0000-0000-0000-200000000003',
  '980c2ba9-5062-42d1-9547-25a8b4471961',
  '5fae190f-29a0-423b-b796-bae351f66b3d',
  'a56d0861-0f9f-4fe8-b1d8-09f44e6c25ca',   -- México
  'Campaña Admin Fabio — MX',
  'producto',
  'checkout',
  'voz',
  'activa',
  NOW(),
  false
)
ON CONFLICT (campana_id) DO NOTHING;

-- ─── 4. PROSPECTOS — TODAS LAS ETAPAS DEL KANBAN ─────────────────────
-- 9 columnas_kanban × 2 tenants = 18 prospectos que cubren el flujo completo

-- TENANT PRUEBA — Campaña producto
INSERT INTO prospectos (
  prospecto_id, tenant_id, socio_id, campana_id, nombre, telefono, correo,
  pais_id, canal_agente, columna_kanban, temperatura, intencion,
  estado_temperatura, visible_para_socio, dias_sin_contacto
) VALUES

-- Etapa 1: nuevo_prospecto / frio
(
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Andrés Torres',       '+50671110001', 'andres@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'nuevo_prospecto', 'frio', 'producto', 'frio', true, 0
),

-- Etapa 2: contactado / frio
(
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Sofía Ramírez',       '+50671110002', 'sofia@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'contactado', 'frio', 'producto', 'frio', true, 1
),

-- Etapa 3: en_seguimiento / tibio → templado
(
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Miguel Ángel Soto',   '+50671110003', 'miguel@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'voz', 'en_seguimiento', 'tibio', 'producto', 'templado', true, 3
),

-- Etapa 4: propuesta_enviada / tibio → templado
(
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Valentina Cruz',      '+50671110004', 'vale@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'propuesta_enviada', 'tibio', 'ambos', 'templado', true, 2
),

-- Etapa 5: listo_para_cerrar / caliente → listo_cierre
(
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Roberto Fuentes',     '+50671110005', 'roberto@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'listo_para_cerrar', 'caliente', 'producto', 'listo_cierre', true, 0
),

-- Etapa 6: cliente_activo / caliente → listo_cierre
(
  '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Carmen Delgado',      '+50671110006', 'carmen@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'avatar', 'cliente_activo', 'caliente', 'ambos', 'listo_cierre', true, 0
),

-- Etapa 7: no_interesado / frio
(
  '00000000-0000-0000-0001-000000000007',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Luis Herrera',        '+50671110007', 'luis@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'no_interesado', 'frio', 'ninguno', 'frio', true, 7
),

-- Etapa 8: sin_respuesta / frio
(
  '00000000-0000-0000-0001-000000000008',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Paola Vargas',        '+50671110008', 'paola@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'texto', 'sin_respuesta', 'frio', 'producto', 'frio', true, 5
),

-- Etapa 9: reagendar / tibio
(
  '00000000-0000-0000-0001-000000000009',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-200000000001',
  'Diego Morales',       '+50671110009', 'diego@test.dev',
  '955e8daf-aeb7-41c9-93d4-c928406d80c4',
  'voz', 'reagendar', 'tibio', 'negocio', 'templado', true, 1
)
ON CONFLICT (prospecto_id) DO NOTHING;

-- TENANT DE FABIO — Prospectos para prueba cross-tenant del admin
INSERT INTO prospectos (
  prospecto_id, tenant_id, socio_id, campana_id, nombre, telefono, correo,
  pais_id, canal_agente, columna_kanban, temperatura, intencion,
  estado_temperatura, visible_para_socio, dias_sin_contacto
) VALUES

(
  '00000000-0000-0000-0002-000000000001',
  '980c2ba9-5062-42d1-9547-25a8b4471961',
  '5fae190f-29a0-423b-b796-bae351f66b3d',
  '00000000-0000-0000-0000-200000000003',
  'Jorge Alvarado (Fabio tenant)',  '+52551110001', 'jorge@test.dev',
  'a56d0861-0f9f-4fe8-b1d8-09f44e6c25ca',
  'texto', 'en_seguimiento', 'tibio', 'producto', 'templado', true, 2
),
(
  '00000000-0000-0000-0002-000000000002',
  '980c2ba9-5062-42d1-9547-25a8b4471961',
  '5fae190f-29a0-423b-b796-bae351f66b3d',
  '00000000-0000-0000-0000-200000000003',
  'Isabel Núñez (Fabio tenant)',    '+52551110002', 'isabel@test.dev',
  'a56d0861-0f9f-4fe8-b1d8-09f44e6c25ca',
  'voz', 'listo_para_cerrar', 'caliente', 'producto', 'listo_cierre', true, 0
)
ON CONFLICT (prospecto_id) DO NOTHING;

-- ─── 5. VERIFICACIÓN FINAL ────────────────────────────────────────────
SELECT
  'tenants'    AS tabla,
  COUNT(*)     AS total
FROM tenants
UNION ALL
SELECT 'socios',    COUNT(*) FROM socios
UNION ALL
SELECT 'campanas',  COUNT(*) FROM campanas
UNION ALL
SELECT 'prospectos',COUNT(*) FROM prospectos
UNION ALL
SELECT 'vista_auditoria_kanban', COUNT(*) FROM vista_auditoria_kanban
ORDER BY tabla;
