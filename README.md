# Sistema de Gestión de Mantenimiento

Sistema web responsivo para la gestión de operaciones de mantenimiento eléctrico y mecánico en empresas.

## Características

- **Frontend**: HTML5, CSS3, TypeScript compilado a Vanilla JavaScript
- **Backend**: Node.js con Hono framework
- **Base de datos**: PostgreSQL
- **Autenticación**: JWT + bcrypt
- **Testing**: Vitest con property-based testing usando fast-check

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

4. Configurar base de datos PostgreSQL

## Desarrollo

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Servidor de desarrollo
npm run dev

# Servidor de producción
npm start

# Ejecutar tests
npm test

# Tests en modo watch
npm run test:watch

# Coverage de tests
npm run test:coverage
```

## Estructura del proyecto

```
/
├── src/
│   ├── frontend/
│   │   ├── index.html          # Página principal
│   │   ├── styles/
│   │   │   └── main.css        # Estilos principales
│   │   └── scripts/
│   │       └── main.ts         # Lógica principal frontend
│   └── backend/
│       └── server.ts           # Servidor Hono principal
├── tests/
│   ├── frontend/               # Tests del frontend
│   └── backend/                # Tests del backend
├── dist/                       # Archivos compilados
├── .env.example               # Plantilla de variables
└── package.json
```

## Scripts disponibles

- `npm run build` - Compilar TypeScript
- `npm run dev` - Servidor de desarrollo
- `npm start` - Servidor de producción
- `npm test` - Ejecutar tests
- `npm run test:watch` - Tests en modo watch
- `npm run test:coverage` - Coverage de tests