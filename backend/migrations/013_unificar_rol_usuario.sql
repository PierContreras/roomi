SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE codigo = 'user')
    INSERT dbo.roles (codigo, nombre) VALUES ('user', N'Usuario');

UPDATE u SET rol_id = nuevo.id
FROM dbo.usuarios u
JOIN dbo.roles anterior ON anterior.id = u.rol_id
CROSS JOIN dbo.roles nuevo
WHERE anterior.codigo IN ('student', 'owner') AND nuevo.codigo = 'user';

DELETE FROM dbo.roles WHERE codigo IN ('student', 'owner');

COMMIT;
