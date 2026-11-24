# Sustentación de ROOMI

La versión de presentación corre en [http://127.0.0.1:4100](http://127.0.0.1:4100) desde la computadora del estudiante. Angular entrega la interfaz compilada, FastAPI procesa las solicitudes y SQL Server persiste los datos en `BD_ROOMI`.

## Volver a iniciar

Desde la raíz de ROOMI, abre dos ventanas de PowerShell. En la primera, inicia FastAPI.

```powershell
Set-Location .\backend
.\.venv\Scripts\python.exe -m uvicorn src.backend.main:app --host 127.0.0.1 --port 8010
```

En la segunda, ejecuta la web compilada. Repite el build si cambias el frontend.

```powershell
Set-Location .\frontend
$env:ROOMI_WEB_HOST = '127.0.0.1'
$env:PORT = '4100'
$env:ROOMI_API_URL = 'http://127.0.0.1:8010'
npm.cmd run serve:ssr:frontend
```

Antes de presentar, [comprueba la base a través de la web](http://127.0.0.1:4100/api/salud). Debe devolver `estado: ok` y `base: BD_ROOMI`. El [contrato de FastAPI](http://127.0.0.1:8010/docs) se puede abrir en la misma computadora. El esquema requiere las [migraciones documentadas en el backend](../backend/README.md#instalar-el-esquema-en-sql-server).

## Recorrido para la evaluación

| Criterio | Qué mostrar |
| --- | --- |
| Frontend | Abre el catálogo en escritorio y en vista móvil. Registra una cuenta, filtra por zona y abre la ficha. En el formulario de publicación, intenta continuar sin título y muestra la validación asociada al campo. |
| Backend | Abre Swagger. Explica qué hace una ruta, qué valida el esquema, cómo evalúa el servicio y qué registra el repositorio. Al crear un anuncio completo con foto y precio dentro del rango, muestra `201 publicado`. |
| Base de datos | Abre `BD_ROOMI` en SQL Server Management Studio. Muestra cómo `alojamientos.owner_id` enlaza con `usuarios.id`, cómo `alojamiento_servicios` resuelve la relación muchos a muchos y cómo `alojamiento_fotos` conserva el orden con la clave `(alojamiento_id, posicion)`. |
| Integración | Publica con una cuenta ordinaria y pulsa **Ver anuncio publicado**. Abre el catálogo en otra pestaña y comprueba que el anuncio aparece primero. Envía otro sin foto y verifica que figure en la cola. Con una cuenta admin distinta, decide con motivo y consulta el historial. |
| Git y trabajo en equipo | Muestra la rama `Pier` y los commits descriptivos con `git log --oneline -8`. Para acreditar Pull Requests, muestra los PR reales del equipo y explica la revisión y la integración que hizo cada integrante. |
| Sustentación | Explica por qué el estado se decide en el servidor, qué pasa ante un anuncio ajeno y cómo se conservan las decisiones al retirar o eliminar un anuncio. |

## Preguntas para ensayar

- **¿Dónde se ejecuta la regla de publicación?** En `services/moderacion_reglas.py`. La API valida la entrada y el repositorio toma en cuenta suspensiones y reportes antes de guardar el resultado y su historial.
- **¿Por qué hay tablas separadas para servicios y fotos?** Un anuncio puede tener varios servicios y fotos. Las filas vinculadas permiten mantener cada relación y su orden bajo claves y restricciones. El nombre de un titular registrado se obtiene de `usuarios`. Los antiguos anuncios sin cuenta vinculada conservan el nombre en una tabla histórica separada.
- **¿Qué ocurre si un usuario cambia la URL para editar otro anuncio?** FastAPI verifica el JWT y el repositorio filtra por titular. Un anuncio ajeno recibe `404`. Un usuario autenticado que intenta moderar sin rol admin recibe `403`.
- **¿Cómo sabes que persistió en SQL Server?** La web llama a `/api` en el mismo origen, el servidor Angular reenvía a FastAPI y el repositorio confirma la transacción. La ficha y el catálogo consultan el estado guardado al volver a abrirlos.
