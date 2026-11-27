SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
    CREATE TABLE dbo.roles (
        id TINYINT IDENTITY PRIMARY KEY,
        codigo VARCHAR(12) NOT NULL UNIQUE,
        nombre NVARCHAR(40) NOT NULL
    );

INSERT dbo.roles (codigo, nombre)
SELECT v.codigo, v.nombre
FROM (VALUES ('student', N'Estudiante'), ('owner', N'Propietario'), ('admin', N'Administrador')) v(codigo, nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.codigo = v.codigo)
  AND (v.codigo = 'admin' OR COL_LENGTH(N'dbo.usuarios', N'role') IS NOT NULL);

IF COL_LENGTH(N'dbo.usuarios', N'rol_id') IS NULL
    ALTER TABLE dbo.usuarios ADD rol_id TINYINT NULL;

IF COL_LENGTH(N'dbo.usuarios', N'role') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE u SET rol_id = r.id
        FROM dbo.usuarios u JOIN dbo.roles r ON r.codigo = u.role
        WHERE u.rol_id IS NULL;
    ';

    DECLARE @eliminar_checks NVARCHAR(MAX);
    SELECT @eliminar_checks = STRING_AGG(
        CAST(N'ALTER TABLE dbo.usuarios DROP CONSTRAINT ' + QUOTENAME(c.name) AS NVARCHAR(MAX)), N';')
    FROM sys.check_constraints c
    WHERE c.parent_object_id = OBJECT_ID(N'dbo.usuarios')
      AND c.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.usuarios'), N'role', 'ColumnId');
    IF @eliminar_checks IS NOT NULL EXEC sp_executesql @eliminar_checks;
    ALTER TABLE dbo.usuarios DROP COLUMN role;
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.usuarios') AND name=N'rol_id' AND is_nullable=1)
    ALTER TABLE dbo.usuarios ALTER COLUMN rol_id TINYINT NOT NULL;

IF OBJECT_ID(N'dbo.FK_usuarios_roles', N'F') IS NULL
    ALTER TABLE dbo.usuarios WITH CHECK ADD CONSTRAINT FK_usuarios_roles FOREIGN KEY (rol_id) REFERENCES dbo.roles(id);

COMMIT;
