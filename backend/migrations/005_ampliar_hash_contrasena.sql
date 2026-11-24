IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.usuarios', N'U')
        AND name = N'password_hash'
        AND system_type_id = TYPE_ID(N'nvarchar')
        AND max_length BETWEEN 1 AND 499
)
    ALTER TABLE dbo.usuarios ALTER COLUMN password_hash NVARCHAR(250) NOT NULL;
