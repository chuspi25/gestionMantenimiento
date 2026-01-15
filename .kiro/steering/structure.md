# Estructura del Proyecto

## Organización de directorios

```
/
├── src/
│   ├── frontend/
│   │   ├── index.html          # Página principal
│   │   ├── styles/
│   │   │   └── main.css        # Estilos principales
│   │   └── scripts/
│   │       ├── main.ts         # Lógica principal frontend
│   │       ├── auth.ts         # Manejo de autenticación
│   │       └── api.ts          # Cliente API
│   ├── backend/
│   │   ├── server.ts           # Servidor Hono principal
│   │   ├── routes/
│   │   │   ├── auth.ts         # Rutas de autenticación
│   │   │   └── api.ts          # Rutas API
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Middleware JWT
│   │   │   └── cors.ts         # Configuración CORS
│   │   ├── services/
│   │   │   ├── AuthService.ts  # Lógica de autenticación
│   │   │   └── UserService.ts  # Gestión de usuarios
│   │   └── utils/
│   │       ├── jwt.ts          # Utilidades JWT
│   │       └── bcrypt.ts       # Utilidades bcrypt
├── tests/
│   ├── frontend/               # Tests del frontend
│   └── backend/                # Tests del backend
├── dist/                       # Archivos compilados
├── .env.example               # Plantilla de variables
├── .gitignore
├── package.json
└── tsconfig.json
```

## Convenciones

### Archivos y carpetas
- **PascalCase**: Clases y servicios (`AuthService.ts`)
- **camelCase**: Funciones y variables
- **kebab-case**: Archivos CSS y HTML

### Separación de responsabilidades
- **Frontend**: Solo lógica de presentación y UX
- **Backend**: Lógica de negocio, autenticación, API
- **Services**: Clases que encapsulan lógica de dominio
- **Utils**: Funciones auxiliares reutilizables
- **Middleware**: Interceptores para rutas

### Imports
- Usar imports relativos para archivos del proyecto
- Agrupar imports: externos primero, internos después