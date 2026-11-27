IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.decisiones_moderacion')
      AND name = N'IX_decisiones_moderacion_anuncio_accion_fecha'
)
    CREATE INDEX IX_decisiones_moderacion_anuncio_accion_fecha
        ON dbo.decisiones_moderacion (anuncio_id, accion, fecha DESC);
