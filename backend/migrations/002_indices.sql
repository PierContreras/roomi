IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.alojamientos') AND name = N'IX_alojamientos_estado'
)
    CREATE INDEX IX_alojamientos_estado ON dbo.alojamientos ([status], id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.alojamientos') AND name = N'IX_alojamientos_propietario'
)
    CREATE INDEX IX_alojamientos_propietario ON dbo.alojamientos (owner_id, id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.consultas') AND name = N'IX_consultas_alojamiento'
)
    CREATE INDEX IX_consultas_alojamiento ON dbo.consultas (alojamiento_id, created_at DESC);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.moderaciones') AND name = N'IX_moderaciones_alojamiento'
)
    CREATE INDEX IX_moderaciones_alojamiento ON dbo.moderaciones (alojamiento_id, created_at DESC);
