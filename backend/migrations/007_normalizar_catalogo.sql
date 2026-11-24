SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.servicios', N'U') IS NULL
    CREATE TABLE dbo.servicios (
        nombre NVARCHAR(60) NOT NULL PRIMARY KEY
    );

IF OBJECT_ID(N'dbo.alojamiento_servicios', N'U') IS NULL
    CREATE TABLE dbo.alojamiento_servicios (
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        servicio NVARCHAR(60) NOT NULL REFERENCES dbo.servicios(nombre),
        posicion INT NOT NULL CHECK (posicion >= 0),
        PRIMARY KEY (alojamiento_id, servicio),
        UNIQUE (alojamiento_id, posicion)
    );

IF OBJECT_ID(N'dbo.alojamiento_fotos', N'U') IS NULL
    CREATE TABLE dbo.alojamiento_fotos (
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        posicion INT NOT NULL CHECK (posicion >= 0),
        src NVARCHAR(MAX) NOT NULL,
        alt NVARCHAR(MAX) NOT NULL,
        PRIMARY KEY (alojamiento_id, posicion)
    );

INSERT dbo.servicios (nombre)
SELECT s.nombre
FROM (VALUES (N'Wifi'), (N'Baño privado'), (N'Amoblado'), (N'Lavandería'), (N'Cocineta'), (N'Agua caliente')) s(nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.servicios actual WHERE actual.nombre=s.nombre);

IF COL_LENGTH(N'dbo.alojamientos', N'amenities_json') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        INSERT dbo.servicios (nombre)
        SELECT DISTINCT j.value
        FROM dbo.alojamientos a CROSS APPLY OPENJSON(a.amenities_json) j
        WHERE NOT EXISTS (SELECT 1 FROM dbo.servicios s WHERE s.nombre=j.value);

        INSERT dbo.alojamiento_servicios (alojamiento_id, servicio, posicion)
        SELECT a.id, j.value, MIN(CONVERT(INT, j.[key]))
        FROM dbo.alojamientos a CROSS APPLY OPENJSON(a.amenities_json) j
        GROUP BY a.id, j.value;
    ';
END;

IF COL_LENGTH(N'dbo.alojamientos', N'photos_json') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        INSERT dbo.alojamiento_fotos (alojamiento_id, posicion, src, alt)
        SELECT a.id, CONVERT(INT, j.[key]), f.src, f.alt
        FROM dbo.alojamientos a CROSS APPLY OPENJSON(a.photos_json) j
        CROSS APPLY OPENJSON(j.value) WITH (src NVARCHAR(MAX), alt NVARCHAR(MAX)) f;
    ';
END;

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE dbo.alojamientos DROP CONSTRAINT ' + QUOTENAME(c.name) + N';'
FROM sys.check_constraints c
WHERE c.parent_object_id = OBJECT_ID(N'dbo.alojamientos')
  AND (c.definition LIKE N'%amenities_json%' OR c.definition LIKE N'%photos_json%');
IF @sql <> N'' EXEC sys.sp_executesql @sql;

IF COL_LENGTH(N'dbo.alojamientos', N'amenities_json') IS NOT NULL
    ALTER TABLE dbo.alojamientos DROP COLUMN amenities_json;
IF COL_LENGTH(N'dbo.alojamientos', N'photos_json') IS NOT NULL
    ALTER TABLE dbo.alojamientos DROP COLUMN photos_json;

IF COL_LENGTH(N'dbo.alojamientos', N'owner') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        IF OBJECT_ID(N''dbo.alojamiento_titular_historico'', N''U'') IS NULL
            CREATE TABLE dbo.alojamiento_titular_historico (
                alojamiento_id VARCHAR(100) NOT NULL PRIMARY KEY REFERENCES dbo.alojamientos(id),
                nombre NVARCHAR(200) NOT NULL
            );
        INSERT dbo.alojamiento_titular_historico (alojamiento_id, nombre)
        SELECT id, [owner] FROM dbo.alojamientos WHERE owner_id IS NULL;
        ALTER TABLE dbo.alojamientos DROP COLUMN [owner];
    ';
END;

COMMIT;
