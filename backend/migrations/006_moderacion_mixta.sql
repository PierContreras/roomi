SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @restriccion sysname;
SELECT @restriccion = name FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.alojamientos')
  AND definition LIKE '%pending%' AND definition LIKE '%approved%';
IF @restriccion IS NOT NULL
BEGIN
    DECLARE @sql nvarchar(max) = N'ALTER TABLE dbo.alojamientos DROP CONSTRAINT ' + QUOTENAME(@restriccion);
    EXEC sys.sp_executesql @sql;
END;

UPDATE dbo.alojamientos SET [status] = CASE [status]
    WHEN 'pending' THEN 'en_revision' WHEN 'Pendiente' THEN 'en_revision'
    WHEN 'approved' THEN 'publicado' WHEN 'rejected' THEN 'rechazado'
    WHEN 'withdrawn' THEN 'retirado' ELSE [status] END
WHERE [status] IN ('pending','Pendiente','approved','rejected','withdrawn');

IF OBJECT_ID(N'dbo.CK_roomi_estado_moderacion', N'C') IS NULL
    ALTER TABLE dbo.alojamientos ADD CONSTRAINT CK_roomi_estado_moderacion
        CHECK ([status] IN ('borrador','publicado','en_revision','rechazado','retirado'));

IF COL_LENGTH(N'dbo.alojamientos', N'motivos_revision') IS NULL
    ALTER TABLE dbo.alojamientos ADD motivos_revision NVARCHAR(800) NOT NULL
        CONSTRAINT DF_roomi_motivos_revision DEFAULT N'[]' CHECK (ISJSON(motivos_revision) = 1);

IF COL_LENGTH(N'dbo.reportes', N'resuelto_fecha') IS NULL
    ALTER TABLE dbo.reportes ADD resuelto_fecha DATETIME2 NULL;

IF OBJECT_ID(N'dbo.suspensiones_propietario', N'U') IS NULL
    CREATE TABLE dbo.suspensiones_propietario (
        id BIGINT IDENTITY PRIMARY KEY,
        propietario_id VARCHAR(36) NOT NULL REFERENCES dbo.usuarios(id),
        responsable_id VARCHAR(36) NOT NULL REFERENCES dbo.usuarios(id),
        motivo NVARCHAR(800) NOT NULL,
        fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        levantada_fecha DATETIME2 NULL,
        levantada_por VARCHAR(36) NULL REFERENCES dbo.usuarios(id),
        levantada_motivo NVARCHAR(800) NULL
    );
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.suspensiones_propietario') AND name = N'UX_roomi_suspension_activa')
    CREATE UNIQUE INDEX UX_roomi_suspension_activa ON dbo.suspensiones_propietario(propietario_id)
        WHERE levantada_fecha IS NULL;

IF OBJECT_ID(N'dbo.decisiones_moderacion', N'U') IS NULL
    CREATE TABLE dbo.decisiones_moderacion (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        anuncio_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        accion VARCHAR(24) NOT NULL CHECK (accion IN ('aprobar','rechazar','retirar','suspender','levantar_suspension','enviar_revision','eliminar')),
        motivo NVARCHAR(800) NOT NULL,
        responsable_id VARCHAR(36) NULL REFERENCES dbo.usuarios(id),
        fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

INSERT dbo.decisiones_moderacion (id, anuncio_id, accion, motivo, responsable_id, fecha)
SELECT m.id, m.alojamiento_id, CASE m.decision WHEN 'approved' THEN 'aprobar' ELSE 'rechazar' END,
    COALESCE(m.note, N''), m.admin_id, m.created_at
FROM dbo.moderaciones m
WHERE NOT EXISTS (SELECT 1 FROM dbo.decisiones_moderacion d WHERE d.id=m.id);
COMMIT;
