# Stack Tecnológico

## Frontend
- **HTML5**: Estructura semántica y accesible
- **CSS3**: Estilos modernos, variables CSS, flexbox/grid
- **TypeScript**: Tipado estático, compilado a JavaScript vanilla
- **Vanilla JS**: Sin frameworks frontend, DOM nativo

## Backend
- **Node.js**: Runtime de JavaScript
- **Hono**: Framework web ligero y rápido
- **bcrypt**: Hash seguro de contraseñas
- **JWT**: Autenticación basada en tokens

## Herramientas de desarrollo
- **TypeScript Compiler**: Transpilación TS → JS
- **Node.js**: Ejecución del servidor
- **npm**: Gestión de dependencias

## Comandos comunes

### Desarrollo
```bash
npm install          # Instalar dependencias
npm run build        # Compilar TypeScript
npm run dev          # Servidor de desarrollo
npm start            # Servidor de producción
npm test             # Ejecutar tests
```

### Testing
```bash
npm run test:watch   # Tests en modo watch
npm run test:coverage # Coverage de tests
```

## Variables de entorno
- Configurar `.env` con API keys y configuración
- Nunca commitear archivos `.env` al repositorio