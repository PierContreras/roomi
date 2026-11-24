:On Error exit
:r .\backend\migrations\000_base.sql

USE [BD_ROOMI];
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
:r .\backend\migrations\000_catalogo.sql
GO
:r .\backend\migrations\001_gestion.sql
GO
:r .\backend\migrations\002_indices.sql
GO
:r .\backend\migrations\003_eliminacion_anuncios.sql
GO
:r .\backend\migrations\004_hash_contrasena_unicode.sql
GO
:r .\backend\migrations\005_ampliar_hash_contrasena.sql
GO
COMMIT TRANSACTION;
GO

SELECT DB_NAME() AS base_de_datos;
SELECT name AS tabla_roomi
FROM sys.tables
WHERE schema_id = SCHEMA_ID(N'dbo')
  AND name IN (N'alojamientos', N'usuarios', N'moderaciones', N'consultas', N'resenas', N'reportes')
ORDER BY name;
GO
