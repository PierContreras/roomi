IF COL_LENGTH(N'dbo.alojamientos', N'deleted_at') IS NULL
    ALTER TABLE dbo.alojamientos ADD deleted_at DATETIME2 NULL;
