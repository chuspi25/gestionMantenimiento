/**
 * Definición de permisos por rol
 */
const ROLE_PERMISSIONS = {
    operator: {
        canViewDashboard: true,
        canViewTasks: true,
        canCreateTasks: false,
        canEditTasks: true, // Solo sus propias tareas
        canDeleteTasks: false,
        canAssignTasks: false,
        canViewAllTasks: false, // Solo sus tareas asignadas
        canViewUsers: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canViewReports: false,
        canExportReports: false,
        canViewSystemSettings: false,
        canEditSystemSettings: false,
    },
    supervisor: {
        canViewDashboard: true,
        canViewTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canDeleteTasks: true,
        canAssignTasks: true,
        canViewAllTasks: true,
        canViewUsers: true,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canViewReports: true,
        canExportReports: true,
        canViewSystemSettings: false,
        canEditSystemSettings: false,
    },
    admin: {
        canViewDashboard: true,
        canViewTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canDeleteTasks: true,
        canAssignTasks: true,
        canViewAllTasks: true,
        canViewUsers: true,
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canViewReports: true,
        canExportReports: true,
        canViewSystemSettings: true,
        canEditSystemSettings: true,
    },
};
/**
 * Definición de rutas de la aplicación
 */
export const APP_ROUTES = [
    {
        path: '/tasks',
        permission: 'canViewTasks',
        title: 'Tareas',
        description: 'Gestión de tareas de mantenimiento'
    },
    {
        path: '/tasks/create',
        permission: 'canCreateTasks',
        fallbackRoute: '/tasks',
        title: 'Crear Tarea',
        description: 'Crear nueva tarea de mantenimiento'
    },
    {
        path: '/users',
        permission: 'canViewUsers',
        fallbackRoute: '/tasks',
        title: 'Usuarios',
        description: 'Gestión de usuarios del sistema'
    },
    {
        path: '/users/create',
        permission: 'canCreateUsers',
        fallbackRoute: '/users',
        title: 'Crear Usuario',
        description: 'Crear nuevo usuario del sistema'
    },
    {
        path: '/reports',
        permission: 'canViewReports',
        fallbackRoute: '/tasks',
        title: 'Reportes',
        description: 'Visualización y generación de reportes'
    },
    {
        path: '/settings',
        permission: 'canViewSystemSettings',
        fallbackRoute: '/tasks',
        title: 'Configuración',
        description: 'Configuración del sistema'
    }
];
/**
 * Clase para manejar el control de acceso basado en roles
 */
export class RoleGuard {
    authManager;
    currentRoute = '/dashboard';
    routeChangeListeners = [];
    constructor(authManager) {
        this.authManager = authManager;
        this.setupRouteHandling();
    }
    /**
     * Configurar manejo de rutas
     */
    setupRouteHandling() {
        // Escuchar cambios en el hash de la URL
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        // Manejar navegación inicial
        this.handleRouteChange();
    }
    /**
     * Manejar cambio de ruta
     */
    handleRouteChange() {
        const hash = window.location.hash.slice(1) || '/dashboard';
        this.navigateToRoute(hash);
    }
    /**
     * Obtener permisos del usuario actual
     */
    getCurrentUserPermissions() {
        const user = this.authManager.getCurrentUser();
        if (!user)
            return null;
        return ROLE_PERMISSIONS[user.role];
    }
    /**
     * Verificar si el usuario tiene un permiso específico
     */
    hasPermission(permission) {
        const permissions = this.getCurrentUserPermissions();
        return permissions ? permissions[permission] : false;
    }
    /**
     * Verificar si el usuario puede acceder a una ruta
     */
    canAccessRoute(routePath) {
        const route = APP_ROUTES.find(r => r.path === routePath);
        if (!route)
            return false;
        return this.hasPermission(route.permission);
    }
    /**
     * Obtener rutas accesibles para el usuario actual
     */
    getAccessibleRoutes() {
        return APP_ROUTES.filter(route => this.hasPermission(route.permission));
    }
    /**
     * Navegar a una ruta específica
     */
    navigateToRoute(routePath) {
        console.log(`🧭 RoleGuard: Intentando navegar a ${routePath}`);
        // Verificar autenticación con más detalle
        const isAuthenticated = this.authManager.isAuthenticated();
        const hasToken = !!this.authManager.getToken();
        const hasUser = !!this.authManager.getCurrentUser();
        console.log(`🔐 RoleGuard: Estado auth - isAuth: ${isAuthenticated}, token: ${hasToken}, user: ${hasUser}`);
        if (!isAuthenticated || !hasToken || !hasUser) {
            console.warn('🚫 RoleGuard: Usuario no autenticado completamente, redirigiendo al login');
            // Disparar evento para mostrar login en lugar de continuar
            window.dispatchEvent(new CustomEvent('auth-required'));
            return false;
        }
        // Verificar permisos para la ruta
        if (!this.canAccessRoute(routePath)) {
            console.warn(`🚫 RoleGuard: Acceso denegado a la ruta: ${routePath}`);
            // Buscar ruta de fallback
            const route = APP_ROUTES.find(r => r.path === routePath);
            if (route?.fallbackRoute && this.canAccessRoute(route.fallbackRoute)) {
                this.navigateToRoute(route.fallbackRoute);
                return false;
            }
            // Redirigir al dashboard si no hay fallback
            if (routePath !== '/dashboard' && this.canAccessRoute('/dashboard')) {
                this.navigateToRoute('/dashboard');
                return false;
            }
            // Si no puede acceder ni al dashboard, mostrar error
            this.showAccessDeniedError();
            return false;
        }
        // Actualizar ruta actual
        this.currentRoute = routePath;
        // Actualizar URL sin recargar la página
        if (window.location.hash.slice(1) !== routePath) {
            window.location.hash = routePath;
        }
        // Notificar a los listeners
        this.routeChangeListeners.forEach(listener => listener(routePath));
        console.log(`✅ RoleGuard: Navegando exitosamente a: ${routePath}`);
        return true;
    }
    /**
     * Obtener ruta actual
     */
    getCurrentRoute() {
        return this.currentRoute;
    }
    /**
     * Agregar listener para cambios de ruta
     */
    onRouteChange(listener) {
        this.routeChangeListeners.push(listener);
    }
    /**
     * Remover listener de cambios de ruta
     */
    removeRouteChangeListener(listener) {
        const index = this.routeChangeListeners.indexOf(listener);
        if (index > -1) {
            this.routeChangeListeners.splice(index, 1);
        }
    }
    /**
     * Verificar si el usuario puede realizar una acción específica
     */
    canPerformAction(action, resourceOwnerId) {
        const permissions = this.getCurrentUserPermissions();
        if (!permissions)
            return false;
        const user = this.authManager.getCurrentUser();
        if (!user)
            return false;
        // Verificar permiso básico
        if (!permissions[action])
            return false;
        // Para operadores, verificar si es el propietario del recurso
        if (user.role === 'operator' && resourceOwnerId) {
            // Los operadores solo pueden editar sus propios recursos
            if (action === 'canEditTasks' || action === 'canDeleteTasks') {
                return user.id === resourceOwnerId;
            }
        }
        return true;
    }
    /**
     * Mostrar error de acceso denegado
     */
    showAccessDeniedError() {
        const errorEvent = new CustomEvent('error-occurred', {
            detail: 'No tienes permisos para acceder a esta sección'
        });
        window.dispatchEvent(errorEvent);
    }
    /**
     * Generar navegación basada en permisos
     */
    generateNavigation() {
        const accessibleRoutes = this.getAccessibleRoutes();
        return accessibleRoutes
            .filter(route => !route.path.includes('/create')) // Excluir rutas de creación del menú principal
            .map(route => ({
            route,
            isActive: route.path === this.currentRoute
        }));
    }
    /**
     * Verificar si se debe mostrar un elemento de UI
     */
    shouldShowElement(permission, resourceOwnerId) {
        return this.canPerformAction(permission, resourceOwnerId);
    }
    /**
     * Obtener mensaje de restricción para una acción
     */
    getRestrictionMessage(permission) {
        const user = this.authManager.getCurrentUser();
        if (!user)
            return 'Debes iniciar sesión para realizar esta acción';
        const messages = {
            canViewDashboard: 'No tienes permisos para ver el dashboard',
            canViewTasks: 'No tienes permisos para ver las tareas',
            canCreateTasks: 'No tienes permisos para crear tareas',
            canEditTasks: 'No tienes permisos para editar tareas',
            canDeleteTasks: 'No tienes permisos para eliminar tareas',
            canAssignTasks: 'No tienes permisos para asignar tareas',
            canViewAllTasks: 'Solo puedes ver tus tareas asignadas',
            canViewUsers: 'No tienes permisos para ver usuarios',
            canCreateUsers: 'No tienes permisos para crear usuarios',
            canEditUsers: 'No tienes permisos para editar usuarios',
            canDeleteUsers: 'No tienes permisos para eliminar usuarios',
            canViewReports: 'No tienes permisos para ver reportes',
            canExportReports: 'No tienes permisos para exportar reportes',
            canViewSystemSettings: 'No tienes permisos para ver la configuración',
            canEditSystemSettings: 'No tienes permisos para editar la configuración',
        };
        return messages[permission] || 'No tienes permisos para realizar esta acción';
    }
    /**
     * Limpiar estado al hacer logout
     */
    clearState() {
        this.currentRoute = '/dashboard';
        this.routeChangeListeners = [];
    }
}
/**
 * Utilidades para elementos del DOM con control de acceso
 */
export class RoleGuardUI {
    roleGuard;
    constructor(roleGuard) {
        this.roleGuard = roleGuard;
    }
    /**
     * Aplicar control de acceso a elementos del DOM
     */
    applyAccessControl() {
        // Buscar elementos con atributo data-permission
        const protectedElements = document.querySelectorAll('[data-permission]');
        protectedElements.forEach(element => {
            const permission = element.getAttribute('data-permission');
            const resourceOwnerId = element.getAttribute('data-resource-owner');
            if (permission && !this.roleGuard.shouldShowElement(permission, resourceOwnerId || undefined)) {
                // Ocultar elemento
                element.style.display = 'none';
                // Agregar clase para CSS
                element.classList.add('access-denied');
                // Opcional: mostrar mensaje de restricción
                const showMessage = element.getAttribute('data-show-restriction') === 'true';
                if (showMessage) {
                    this.showRestrictionMessage(element, permission);
                }
            }
            else {
                // Mostrar elemento
                element.style.display = '';
                element.classList.remove('access-denied');
            }
        });
    }
    /**
     * Mostrar mensaje de restricción en un elemento
     */
    showRestrictionMessage(element, permission) {
        const message = this.roleGuard.getRestrictionMessage(permission);
        // Crear elemento de mensaje
        const messageElement = document.createElement('div');
        messageElement.className = 'restriction-message';
        messageElement.textContent = message;
        messageElement.style.cssText = `
      color: var(--text-secondary);
      font-style: italic;
      font-size: 0.875rem;
      padding: 0.5rem;
      background: var(--background-color);
      border-radius: var(--radius);
      border: 1px solid var(--border-color);
    `;
        // Reemplazar contenido del elemento
        element.innerHTML = '';
        element.appendChild(messageElement);
    }
    /**
     * Generar menú de navegación
     */
    generateNavigationMenu(containerId) {
        const container = document.getElementById(containerId);
        if (!container)
            return;
        const navigation = this.roleGuard.generateNavigation();
        const navHTML = navigation.map(({ route, isActive }) => `
      <a href="#${route.path}" 
         class="nav-link ${isActive ? 'active' : ''}"
         title="${route.description || route.title}">
        ${route.title}
      </a>
    `).join('');
        container.innerHTML = navHTML;
    }
    /**
     * Actualizar navegación cuando cambie la ruta
     */
    updateNavigation(containerId) {
        this.generateNavigationMenu(containerId);
    }
}
