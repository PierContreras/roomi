SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.moderaciones', N'U') IS NOT NULL
BEGIN
    -- La migración 006 copió el historial. Verificar también su contenido antes del DROP.
    IF EXISTS (
        SELECT id, alojamiento_id, CASE decision WHEN 'approved' THEN 'aprobar' ELSE 'rechazar' END,
               COALESCE(note, N''), admin_id, created_at
        FROM dbo.moderaciones WITH (TABLOCKX, HOLDLOCK)
        EXCEPT
        SELECT id, anuncio_id, accion, motivo, responsable_id, fecha
        FROM dbo.decisiones_moderacion WITH (HOLDLOCK)
    )
        THROW 51010, N'Hay registros de moderación sin una copia equivalente en decisiones_moderacion.', 1;

    DROP TABLE dbo.moderaciones;
END;

COMMIT;
