IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
    CREATE TABLE dbo.usuarios (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(180) NOT NULL,
        role VARCHAR(12) NOT NULL CHECK (role IN ('student', 'owner', 'admin'))
    );

IF COL_LENGTH('dbo.alojamientos', 'owner_id') IS NULL
    ALTER TABLE dbo.alojamientos ADD owner_id VARCHAR(36) NULL REFERENCES dbo.usuarios(id);
IF COL_LENGTH('dbo.alojamientos', 'revision') IS NULL
    ALTER TABLE dbo.alojamientos ADD revision INT NOT NULL CONSTRAINT DF_roomi_revision DEFAULT (1);
IF COL_LENGTH('dbo.alojamientos', 'review_note') IS NULL
    ALTER TABLE dbo.alojamientos ADD review_note NVARCHAR(800) NULL;
IF COL_LENGTH('dbo.alojamientos', 'latitude') IS NULL
    ALTER TABLE dbo.alojamientos ADD latitude FLOAT NULL CHECK (latitude BETWEEN -90 AND 90);
IF COL_LENGTH('dbo.alojamientos', 'longitude') IS NULL
    ALTER TABLE dbo.alojamientos ADD longitude FLOAT NULL CHECK (longitude BETWEEN -180 AND 180);
IF COL_LENGTH('dbo.alojamientos', 'distance_km') IS NULL
    ALTER TABLE dbo.alojamientos ADD distance_km DECIMAL(6, 3) NULL CHECK (distance_km BETWEEN 0 AND 100);
IF COL_LENGTH('dbo.alojamientos', 'whatsapp') IS NULL
    ALTER TABLE dbo.alojamientos ADD whatsapp VARCHAR(15) NULL;

IF OBJECT_ID(N'dbo.moderaciones', N'U') IS NULL
    CREATE TABLE dbo.moderaciones (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        admin_id VARCHAR(36) NOT NULL REFERENCES dbo.usuarios(id),
        decision VARCHAR(12) NOT NULL CHECK (decision IN ('approved', 'rejected')),
        note NVARCHAR(800) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.consultas', N'U') IS NULL
    CREATE TABLE dbo.consultas (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(180) NOT NULL,
        message NVARCHAR(800) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.resenas', N'U') IS NULL
    CREATE TABLE dbo.resenas (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        student_id VARCHAR(36) NOT NULL REFERENCES dbo.usuarios(id),
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        message NVARCHAR(800) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UNIQUE (alojamiento_id, student_id)
    );

IF OBJECT_ID(N'dbo.reportes', N'U') IS NULL
    CREATE TABLE dbo.reportes (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        alojamiento_id VARCHAR(100) NOT NULL REFERENCES dbo.alojamientos(id),
        student_id VARCHAR(36) NOT NULL REFERENCES dbo.usuarios(id),
        message NVARCHAR(800) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UNIQUE (alojamiento_id, student_id)
    );
