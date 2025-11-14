# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Notas sobre seguridad y separación cliente/servidor

- El frontend público (landing) ahora está en `src/landing/LandingPublic.jsx` y está accesible en `/`.
- Rutas sensibles de la aplicación (crear partida, ver partida) están protegidas mediante `src/routes/ProtectedRoute.jsx` y requieren autenticación.
- La lógica de autenticación vive en `src/auth/AuthProvider.jsx` que guarda el token en `localStorage` y configura `axios` con el header `Authorization`.
- En producción, asegúrate de usar HTTPS y configurar CORS/CSRF en el backend; el backend debe validar tokens JWT en cada endpoint.
- Datos dinámicos (equipo, stack) están en `src/landing/data/*.json` para facilitar edición; si prefieres control desde servidor, mueve estos datos a un endpoint como `/api/v1/team`.

```
