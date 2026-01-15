# 🔧 Sistema de Gestión de Mantenimiento

Sistema web completo y responsivo para la gestión de operaciones de mantenimiento eléctrico y mecánico en empresas. Desarrollado con tecnologías modernas y arquitectura limpia.

## ✨ Características Principales

### 🎨 Frontend
- **HTML5, CSS3, TypeScript** compilado a Vanilla JavaScript
- Interfaz responsiva y moderna
- Sistema de notificaciones en tiempo real
- Gestión de roles y permisos (RBAC)
- Dashboard interactivo con métricas

### ⚙️ Backend
- **Node.js** con framework **Hono** (ligero y rápido)
- API RESTful completa
- Autenticación JWT + bcrypt
- Middleware de seguridad y validación
- Manejo robusto de errores

### 🗄️ Base de Datos
- **PostgreSQL** con pool de conexiones
- Migraciones y seeds incluidos
- Encriptación de datos sensibles

### 🧪 Testing
- Suite completa de tests con **Vitest**
- Property-based testing con **fast-check**
- Tests unitarios y de integración
- Cobertura de código

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- PostgreSQL 14+
- npm o yarn

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/TU_USUARIO/sistema-gestion-mantenimiento.git
   cd sistema-gestion-mantenimiento
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Edita el archivo `.env` con tus configuraciones:
   ```env
   # Base de datos
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=maintenance_db
   DB_USER=tu_usuario
   DB_PASSWORD=tu_password
   
   # JWT
   JWT_SECRET=tu_secreto_super_seguro
   
   # Servidor
   PORT=3001
   ```

4. **Configurar base de datos**
   ```bash
   # Crear la base de datos en PostgreSQL
   createdb maintenance_db
   
   # Inicializar tablas
   npm run init-db
   ```

5. **Compilar el proyecto**
   ```bash
   npm run build
   ```

6. **Iniciar el servidor**
   ```bash
   npm start
   ```

7. **Abrir en el navegador**
   ```
   http://localhost:3001
   ```

## 👥 Usuarios de Prueba

El sistema incluye usuarios de prueba para cada rol:

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@empresa.com | admin123 | Administrador |
| supervisor@empresa.com | super123 | Supervisor |
| operador@empresa.com | oper123 | Operador |

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── frontend/              # Código del frontend
│   │   ├── index.html        # Página principal
│   │   ├── styles/           # Estilos CSS
│   │   └── scripts/          # TypeScript/JavaScript
│   │       ├── main.ts       # Punto de entrada
│   │       ├── auth.ts       # Autenticación
│   │       ├── dashboard.ts  # Dashboard
│   │       ├── taskList.ts   # Lista de tareas
│   │       └── ...
│   └── backend/              # Código del backend
│       ├── server.ts         # Servidor principal
│       ├── routes/           # Rutas de la API
│       ├── services/         # Lógica de negocio
│       ├── middleware/       # Middleware
│       ├── models/           # Modelos de datos
│       └── utils/            # Utilidades
├── tests/                    # Tests
│   ├── frontend/            # Tests del frontend
│   └── backend/             # Tests del backend
│       ├── unit/            # Tests unitarios
│       └── properties/      # Property-based tests
├── dist/                    # Archivos compilados (generado)
├── .kiro/                   # Especificaciones y documentación
│   ├── specs/              # Especificaciones de features
│   └── steering/           # Guías del proyecto
├── .env.example            # Plantilla de variables de entorno
├── package.json            # Dependencias y scripts
└── tsconfig.json           # Configuración TypeScript
```

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run build          # Compilar TypeScript
npm run dev           # Servidor de desarrollo con recarga automática
npm start             # Servidor de producción

# Testing
npm test              # Ejecutar todos los tests
npm run test:watch    # Tests en modo watch
npm run test:coverage # Generar reporte de cobertura

# Base de datos
npm run init-db       # Inicializar base de datos con datos de prueba

# Utilidades
npm run lint          # Verificar código
```

## 🎯 Funcionalidades

### Para Administradores
- ✅ Gestión completa de usuarios
- ✅ Creación y asignación de tareas
- ✅ Visualización de reportes y métricas
- ✅ Configuración del sistema

### Para Supervisores
- ✅ Creación y asignación de tareas
- ✅ Seguimiento de progreso
- ✅ Generación de reportes
- ✅ Gestión de operadores

### Para Operadores
- ✅ Visualización de tareas asignadas
- ✅ Actualización de estado de tareas
- ✅ Registro de notas y comentarios
- ✅ Visualización de historial

## 🔒 Seguridad

- Autenticación JWT con tokens seguros
- Contraseñas hasheadas con bcrypt
- Validación de entrada en frontend y backend
- Protección contra inyección SQL
- Rate limiting en API
- CORS configurado
- Logs seguros sin información sensible

## 🧪 Testing

El proyecto incluye una suite completa de tests:

- **Tests Unitarios**: Verifican funciones individuales
- **Tests de Integración**: Verifican flujos completos
- **Property-Based Tests**: Verifican propiedades universales con datos aleatorios

```bash
# Ejecutar todos los tests
npm test

# Tests específicos
npm test -- auth.test.ts

# Con cobertura
npm run test:coverage
```

## 📊 Tecnologías Utilizadas

### Frontend
- TypeScript
- Vanilla JavaScript (sin frameworks)
- CSS3 con variables y grid/flexbox
- HTML5 semántico

### Backend
- Node.js
- Hono (framework web)
- PostgreSQL (base de datos)
- JWT (autenticación)
- bcrypt (hash de contraseñas)

### Testing
- Vitest (test runner)
- fast-check (property-based testing)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 👨‍💻 Autor

Desarrollado con ❤️ para la gestión eficiente de mantenimiento

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
