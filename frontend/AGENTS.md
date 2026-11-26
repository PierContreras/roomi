# Instrucciones para trabajar en el frontend

- Usa Angular y ubica las pantallas y los componentes en `src/app/components/`, dentro de la carpeta que corresponda a su función. Reutiliza los elementos de `components/shared/` y los estilos existentes.
- Mantén los contratos de datos en `src/app/interfaces/` y las solicitudes HTTP en `src/app/services/`. Usa rutas relativas bajo `/api` mediante el proxy configurado.
- Actualiza la interfaz tras una respuesta de la API sin recargar la página. Maneja los estados de carga, error y resultados vacíos en las pantallas que consultan datos.
- Revisa los flujos de estudiantes, propietarios y administradores en escritorio y móvil. Las guardas de Angular controlan la navegación y FastAPI valida los permisos.
- Antes de entregar, ejecuta `npm.cmd run build` y `npm.cmd test -- --watch=false` desde `frontend`.
