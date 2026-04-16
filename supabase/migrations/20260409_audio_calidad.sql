-- Campos de calidad técnica para audios del socio
ALTER TABLE audios_socio
  ADD COLUMN IF NOT EXISTS lufs_estimado         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS snr_estimado          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pico_db               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS duracion_segundos     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sample_rate_original  INTEGER,
  ADD COLUMN IF NOT EXISTS requiere_regrabacion  BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice parcial para audit dashboard (solo los que tienen problemas de calidad)
CREATE INDEX IF NOT EXISTS idx_as_regrabacion
  ON audios_socio(socio_id, clave)
  WHERE requiere_regrabacion = TRUE;

-- Índice para ordenar por calidad en el dashboard
CREATE INDEX IF NOT EXISTS idx_as_snr
  ON audios_socio(snr_estimado)
  WHERE snr_estimado IS NOT NULL;
