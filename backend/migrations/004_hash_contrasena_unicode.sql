IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.usuarios', N'U')
        AND name = N'password_hash'
        AND system_type_id = TYPE_ID(N'varchar')
)
    ALTER TABLE dbo.usuarios ALTER COLUMN password_hash NVARCHAR(180) NOT NULL;
