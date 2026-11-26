SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.alojamientos', N'ocupado') IS NULL
    ALTER TABLE dbo.alojamientos ADD ocupado BIT NOT NULL CONSTRAINT DF_alojamientos_ocupado DEFAULT 0;

IF COL_LENGTH(N'dbo.consultas', N'respondida_fecha') IS NULL
    ALTER TABLE dbo.consultas ADD respondida_fecha DATETIME2 NULL;

COMMIT;
