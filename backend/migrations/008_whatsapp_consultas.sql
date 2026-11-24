SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.consultas', N'whatsapp') IS NULL
    ALTER TABLE dbo.consultas ADD whatsapp VARCHAR(15) NULL
        CONSTRAINT CK_consultas_whatsapp CHECK (
            LEN(whatsapp) BETWEEN 8 AND 15 AND whatsapp NOT LIKE '%[^0-9]%' AND whatsapp NOT LIKE '0%'
        );

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.consultas', N'U') AND name = N'email' AND is_nullable = 0
)
    ALTER TABLE dbo.consultas ALTER COLUMN email NVARCHAR(180) NULL;

COMMIT;
