import { AuthManager, LoginFormValidator } from './auth.js';
import { RoleGuard, RoleGuardUI } from './roleGuard.js';
import { TaskList } from './taskList.js';
import { TaskDetail } from './taskDetail.js';
import { TaskForm } from './taskForm.js';
import { TaskProgress } from './taskProgress.js';
import { Dashboard } from './dashboard.js';
import { ReportingInterface } from './reportingInterface.js';
import { UserList } from './userList.js';
import { UserForm } from './userForm.js';
import { ProfileManager } from './profileManager.js';
import { notificationManager } from './notifications.js';
// Offline functionality available for future use
import { User, Task } from './types.js';

// Punto de entrada principal de la aplicación frontend
console.log('Maintenance App - Frontend iniciado');

// Instancias globales
let authManager: AuthManager;
let loginValidator: LoginFormValidator;
let roleGuard: RoleGuard;
let roleGuardUI: RoleGuardUI;
let taskList: TaskList | null = null;
let taskDetail: TaskDetail | null = null;
let taskForm: TaskForm | null = null;
let taskProgress: TaskProgress | null = null;
// Dashboard and reporting instances available for future use
let userList: UserList | null = null;
let userForm: UserForm | null = null;
let profileManager: ProfileManager | null = null;

// Elementos del DOM
let loginContainer: HTMLElement;
let mainApp: HTMLElement;
let loginForm: HTMLFormElement;
let loginButton: HTMLButtonElement;
let togglePasswordButton: HTMLButtonElement;
let logoutButton: HTMLButtonElement;
let userNameElement: HTMLElement;

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');
    initializeApp();
});

/**
 * Inicializar la aplicación
 */
async function initializeApp(): Promise<void> {
    try {
        // Obtener elementos del DOM
        getDOMElements();
        
        // Inicializar servicios
        authManager = new AuthManager();
        loginValidator = new LoginFormValidator('login-form');
        roleGuard = new RoleGuard(authManager);
        roleGuardUI = new RoleGuardUI(roleGuard);
        
        // Inicializar gestores offline y sincronización
        // offlineManager y syncIndicator ya están inicializados como instancias globales
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar RoleGuard
        setupRoleGuard();
        
        // Hacer roleGuard disponible globalmente para onclick handlers
        (window as any).roleGuard = roleGuard;
        
        // Verificar estado de autenticación
        await checkAuthenticationState();
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
        showError('Error inicializando la aplicación');
    }
}

/**
 * Obtener elementos del DOM
 */
function getDOMElements(): void {
    loginContainer = document.getElementById('login-container')!;
    mainApp = document.getElementById('main-app')!;
    loginForm = document.getElementById('login-form') as HTMLFormElement;
    loginButton = document.getElementById('login-button') as HTMLButtonElement;
    togglePasswordButton = document.getElementById('toggle-password') as HTMLButtonElement;
    logoutButton = document.getElementById('logout-button') as HTMLButtonElement;
    userNameElement = document.getElementById('user-name') as HTMLElement;

    if (!loginContainer || !mainApp || !loginForm) {
        throw new Error('Elementos esenciales del DOM no encontrados');
    }
}

/**
 * Configurar RoleGuard
 */
function setupRoleGuard(): void {
    // Configurar listener para cambios de ruta
    roleGuard.onRouteChange((route) => {
        console.log('Ruta cambiada:', route);
        updateMainContent(route);
        roleGuardUI.updateNavigation('navigation');
        roleGuardUI.applyAccessControl();
    });
}

/**
 * Configurar event listeners
 */
function setupEventListeners(): void {
    // Formulario de login
    loginForm.addEventListener('submit', handleLoginSubmit);
    
    // Botón de mostrar/ocultar contraseña
    togglePasswordButton.addEventListener('click', togglePasswordVisibility);
    
    // Botón de logout
    logoutButton.addEventListener('click', handleLogout);
    
    // Eventos personalizados de autenticación
    window.addEventListener('user-login', handleUserLogin as EventListener);
    window.addEventListener('user-logout', handleUserLogout);
    
    // Manejo de errores globales
    window.addEventListener('error-occurred', handleGlobalError as EventListener);
    
    // Manejo de requerimiento de autenticación
    window.addEventListener('auth-required', handleAuthRequired);
    
    // Enlace de "olvidé mi contraseña"
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', handleForgotPassword);
    }
}

/**
 * Verificar estado de autenticación inicial
 */
async function checkAuthenticationState(): Promise<void> {
    console.log('🔍 Verificando estado de autenticación...');
    
    // Dar más tiempo al AuthManager para cargar datos almacenados
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('🔐 Estado AuthManager:', {
        isAuthenticated: authManager.isAuthenticated(),
        hasToken: !!authManager.getToken(),
        hasUser: !!authManager.getCurrentUser()
    });
    
    if (authManager.isAuthenticated()) {
        const user = authManager.getCurrentUser();
        if (user) {
            console.log('✅ Usuario autenticado encontrado:', user.name);
            showMainApp(user);
        } else {
            console.log('⚠️ Token encontrado pero usuario no disponible');
            showLoginForm();
        }
    } else {
        console.log('ℹ️ Usuario no autenticado, mostrando login');
        showLoginForm();
    }
}

/**
 * Manejar envío del formulario de login
 */
async function handleLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    try {
        // Limpiar errores previos
        loginValidator.clearGeneralError();
        
        // Validar formulario
        const validation = loginValidator.validateForm();
        if (!validation.isValid) {
            return;
        }
        
        // Obtener datos del formulario
        const formData = loginValidator.getFormData();
        const rememberMe = (document.getElementById('remember-me') as HTMLInputElement).checked;
        
        // Mostrar estado de carga
        setLoginLoading(true);
        
        // Realizar login
        const response = await authManager.login(formData.email, formData.password, rememberMe);
        
        console.log('✅ Login exitoso:', response.user.name);
        
        // La transición a la app principal se maneja en el event listener
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        
        let errorMessage = 'Error al iniciar sesión';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        loginValidator.showGeneralError(errorMessage);
    } finally {
        setLoginLoading(false);
    }
}

/**
 * Manejar logout
 */
async function handleLogout(): Promise<void> {
    try {
        await authManager.logout();
        console.log('✅ Logout exitoso');
    } catch (error) {
        console.error('❌ Error en logout:', error);
        // Aún así, mostrar el formulario de login
        showLoginForm();
    }
}

/**
 * Manejar evento de login exitoso
 */
function handleUserLogin(event: Event): void {
    const customEvent = event as CustomEvent<User>;
    const user = customEvent.detail;
    showMainApp(user);
}

/**
 * Manejar evento de logout
 */
function handleUserLogout(): void {
    showLoginForm();
}

/**
 * Manejar requerimiento de autenticación
 */
function handleAuthRequired(): void {
    console.log('🔐 Autenticación requerida, mostrando login');
    showLoginForm();
}

/**
 * Manejar errores globales
 */
function handleGlobalError(event: Event): void {
    const customEvent = event as CustomEvent<string>;
    const message = customEvent.detail;
    showError(message);
}

/**
 * Manejar "olvidé mi contraseña"
 */
function handleForgotPassword(event: Event): void {
    event.preventDefault();
    alert('Funcionalidad de recuperación de contraseña no implementada aún');
}

/**
 * Alternar visibilidad de la contraseña
 */
function togglePasswordVisibility(): void {
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const icon = togglePasswordButton.querySelector('.toggle-password-icon') as HTMLElement;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = '🙈';
        togglePasswordButton.setAttribute('aria-label', 'Ocultar contraseña');
    } else {
        passwordInput.type = 'password';
        icon.textContent = '👁️';
        togglePasswordButton.setAttribute('aria-label', 'Mostrar contraseña');
    }
}

/**
 * Establecer estado de carga del login
 */
function setLoginLoading(loading: boolean): void {
    const buttonText = loginButton.querySelector('.button-text') as HTMLElement;
    const buttonSpinner = loginButton.querySelector('.button-spinner') as HTMLElement;
    
    if (loading) {
        loginButton.disabled = true;
        buttonText.style.display = 'none';
        buttonSpinner.style.display = 'flex';
        loginForm.classList.add('loading');
    } else {
        loginButton.disabled = false;
        buttonText.style.display = 'block';
        buttonSpinner.style.display = 'none';
        loginForm.classList.remove('loading');
    }
}

/**
 * Mostrar formulario de login
 */
function showLoginForm(): void {
    loginContainer.style.display = 'flex';
    mainApp.style.display = 'none';
    
    // Limpiar formulario
    loginValidator.reset();
    
    // Focus en el campo de email
    const emailInput = document.getElementById('email') as HTMLInputElement;
    setTimeout(() => emailInput.focus(), 100);
    
    console.log('📋 Mostrando formulario de login');
}

/**
 * Mostrar aplicación principal
 */
function showMainApp(user: User): void {
    console.log('🏠 Mostrando aplicación principal para:', user.name);
    
    loginContainer.style.display = 'none';
    mainApp.style.display = 'flex';
    
    // Actualizar información del usuario
    userNameElement.textContent = user.name;
    
    // Generar navegación basada en permisos
    roleGuardUI.generateNavigationMenu('navigation');
    
    // Asegurar que authManager esté completamente listo antes de navegar
    setTimeout(() => {
        console.log('🔐 Verificando authManager antes de navegar:', {
            isAuthenticated: authManager.isAuthenticated(),
            hasToken: !!authManager.getToken(),
            hasUser: !!authManager.getCurrentUser()
        });
        
        // Navegar a la ruta inicial (dashboard)
        const success = roleGuard.navigateToRoute('/dashboard');
        if (!success) {
            console.warn('⚠️ No se pudo navegar al dashboard, reintentando...');
            // Reintentar después de un momento
            setTimeout(() => {
                const retrySuccess = roleGuard.navigateToRoute('/dashboard');
                if (!retrySuccess) {
                    console.error('❌ Fallo al navegar al dashboard después del reintento');
                }
            }, 500);
        }
    }, 200);
}

/**
 * Actualizar contenido principal basado en la ruta
 */
function updateMainContent(route: string): void {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    const user = authManager.getCurrentUser();
    if (!user) return;
    
    // Limpiar contenido anterior
    mainContent.innerHTML = '';
    
    // Cargar contenido basado en la ruta
    switch (route) {
        case '/dashboard':
            loadDashboardContent(mainContent, user);
            break;
        case '/tasks':
            loadTasksContent(mainContent, user);
            break;
        case '/tasks/create':
            loadCreateTaskContent(mainContent, user);
            break;
        case '/users':
            loadUsersContent(mainContent, user);
            break;
        case '/users/create':
            loadCreateUserContent(mainContent, user);
            break;
        case '/reports':
            loadReportsContent(mainContent, user);
            break;
        case '/settings':
            loadSettingsContent(mainContent, user);
            break;
        case '/profile':
            loadSettingsContent(mainContent, user);
            break;
        default:
            loadDashboardContent(mainContent, user);
    }
    
    // Aplicar control de acceso a los nuevos elementos
    roleGuardUI.applyAccessControl();
}

/**
 * Cargar contenido del dashboard
 */
function loadDashboardContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div id="dashboard-container" class="dashboard-container">
            <!-- El componente Dashboard se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente Dashboard
    initializeDashboard();
}

/**
 * Cargar contenido de tareas
 */
function loadTasksContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div class="page-header">
            <h2>Gestión de Tareas</h2>
            <div class="page-actions">
                <button class="primary-button" data-permission="canCreateTasks" onclick="roleGuard.navigateToRoute('/tasks/create')">
                    Crear Nueva Tarea
                </button>
            </div>
        </div>
        
        <div id="task-list-container" class="tasks-content">
            <!-- El componente TaskList se inicializará aquí -->
        </div>
        
        <div id="task-detail-container" class="tasks-content" style="display: none;">
            <!-- El componente TaskDetail se inicializará aquí -->
        </div>
        
        <div id="task-progress-container" class="task-progress-container" style="display: none;">
            <!-- El componente TaskProgress se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente TaskList
    initializeTaskList();
}

/**
 * Cargar contenido de creación de tareas
 */
function loadCreateTaskContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div class="page-header">
            <h2>Crear Nueva Tarea</h2>
            <button class="secondary-button" onclick="roleGuard.navigateToRoute('/tasks')">
                Volver a Tareas
            </button>
        </div>
        
        <div id="task-form-container" class="form-content">
            <!-- El componente TaskForm se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente TaskForm
    initializeTaskForm('create');
}

/**
 * Cargar contenido de usuarios
 */
function loadUsersContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div id="user-list-container" class="user-list-container">
            <!-- El componente UserList se inicializará aquí -->
        </div>
        
        <div id="user-form-container" class="user-form-container" style="display: none;">
            <!-- El componente UserForm se inicializará aquí -->
        </div>
        
        <div id="profile-manager-container" class="profile-manager-container" style="display: none;">
            <!-- El componente ProfileManager se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente UserList
    initializeUserList();
}

/**
 * Cargar contenido de creación de usuarios
 */
function loadCreateUserContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div id="create-user-form-container" class="create-user-form-container">
            <!-- El componente UserForm se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente UserForm en modo creación
    initializeUserForm('create');
}

/**
 * Cargar contenido de reportes
 */
function loadReportsContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div id="reporting-interface-container" class="reporting-interface-container">
            <!-- El componente ReportingInterface se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente ReportingInterface
    initializeReportingInterface();
}

/**
 * Cargar contenido de configuración
 */
function loadSettingsContent(container: HTMLElement, _user: User): void {
    container.innerHTML = `
        <div id="profile-settings-container" class="profile-settings-container">
            <!-- El componente ProfileManager se inicializará aquí -->
        </div>
    `;
    
    // Inicializar el componente ProfileManager
    initializeProfileManager();
}

/**
 * Obtener nombre de rol para mostrar
 */
// Role display function available for future use

/**
 * Mostrar mensaje de error
 */
function showError(message: string): void {
    console.error('Error:', message);
    
    // Usar el sistema de notificaciones global
    notificationManager.error(message);
}

/**
 * Mostrar mensaje de éxito
 */
function showSuccess(message: string): void {
    console.log('Success:', message);
    
    // Usar el sistema de notificaciones global
    notificationManager.success(message);
}

// Exportar funciones para uso en otros módulos
export { authManager, showError, showSuccess, showTaskDetail, editTask, updateTaskStatus };

/**
 * Inicializar el componente Dashboard
 */
function initializeDashboard(): void {
    console.log('🚀 Inicializando Dashboard...');
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
        try {
            const dashboard = new Dashboard('dashboard-container');
            // Hacer disponible globalmente para el botón de reintentar
            (window as any).dashboardInstance = dashboard;
            console.log('✅ Dashboard inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Dashboard:', error);
            showError('Error inicializando el dashboard');
        }
    } else {
        console.log('ℹ️ Container dashboard-container no encontrado, Dashboard no inicializado');
    }
}

/**
 * Inicializar el componente ReportingInterface
 */
function initializeReportingInterface(): void {
    const reportingContainer = document.getElementById('reporting-interface-container');
    if (reportingContainer) {
        try {
            new ReportingInterface('reporting-interface-container');
            console.log('✅ ReportingInterface inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando ReportingInterface:', error);
            showError('Error inicializando la interfaz de reportes');
        }
    } else {
        console.log('ℹ️ Container reporting-interface-container no encontrado, ReportingInterface no inicializado');
    }
}

/**
 * Inicializar el componente UserList
 */
function initializeUserList(): void {
    console.log('🚀 Inicializando UserList...');
    const userListContainer = document.getElementById('user-list-container');
    if (userListContainer) {
        try {
            userList = new UserList('user-list-container', {
                onEditUser: (user: User) => {
                    console.log('Editar usuario:', user);
                    showUserForm('edit', user);
                },
                onCreateUser: () => {
                    console.log('Crear nuevo usuario');
                    showUserForm('create');
                },
                onViewUser: (user: User) => {
                    console.log('Ver usuario:', user);
                    showUserProfile(user);
                }
            });
            console.log('✅ UserList inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando UserList:', error);
            showError('Error inicializando la lista de usuarios');
        }
    } else {
        console.log('ℹ️ Container user-list-container no encontrado, UserList no inicializado');
    }
}

/**
 * Inicializar el componente UserForm
 */
function initializeUserForm(mode: 'create' | 'edit', user?: User): void {
    const userFormContainer = document.getElementById('create-user-form-container') || 
                             document.getElementById('user-form-container');
    if (userFormContainer) {
        try {
            userForm = new UserForm(userFormContainer.id, {
                onSave: (savedUser: User) => {
                    console.log('✅ Usuario guardado exitosamente:', savedUser.name);
                    
                    // Mostrar mensaje de éxito inmediatamente
                    const action = mode === 'create' ? 'creado' : 'actualizado';
                    showSuccess(`Usuario "${savedUser.name}" ${action} exitosamente`);
                    
                    // Actualizar UserList inmediatamente si está disponible
                    if (userList) {
                        userList.refresh();
                    }
                    
                    // Navegar de vuelta a la lista de usuarios con un pequeño delay
                    setTimeout(() => {
                        roleGuard.navigateToRoute('/users');
                    }, 500);
                },
                onCancel: () => {
                    // Navegar de vuelta a la lista de usuarios
                    roleGuard.navigateToRoute('/users');
                }
            });
            
            if (mode === 'edit' && user) {
                userForm.setEditMode(user);
            } else {
                userForm.setCreateMode();
            }
            
            console.log('✅ UserForm inicializado correctamente en modo:', mode);
        } catch (error) {
            console.error('❌ Error inicializando UserForm:', error);
            showError('Error inicializando el formulario de usuarios');
        }
    } else {
        console.log('ℹ️ Container de UserForm no encontrado, UserForm no inicializado');
    }
}

/**
 * Inicializar el componente ProfileManager
 */
function initializeProfileManager(): void {
    const profileContainer = document.getElementById('profile-settings-container') ||
                            document.getElementById('profile-manager-container');
    if (profileContainer) {
        try {
            profileManager = new ProfileManager(profileContainer.id);
            console.log('✅ ProfileManager inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando ProfileManager:', error);
            showError('Error inicializando el gestor de perfil');
        }
    } else {
        console.log('ℹ️ Container de ProfileManager no encontrado, ProfileManager no inicializado');
    }
}

/**
 * Mostrar formulario de usuario
 */
function showUserForm(mode: 'create' | 'edit', user?: User): void {
    const userListContainer = document.getElementById('user-list-container');
    const userFormContainer = document.getElementById('user-form-container');
    
    if (userListContainer && userFormContainer) {
        // Ocultar lista de usuarios
        userListContainer.style.display = 'none';
        
        // Mostrar contenedor de formulario
        userFormContainer.style.display = 'block';
        
        // Inicializar UserForm
        try {
            userForm = new UserForm('user-form-container', {
                onSave: (savedUser: User) => {
                    console.log('✅ Usuario guardado exitosamente:', savedUser.name);
                    
                    // Mostrar mensaje de éxito inmediatamente
                    const action = mode === 'create' ? 'creado' : 'actualizado';
                    showSuccess(`Usuario "${savedUser.name}" ${action} exitosamente`);
                    
                    // Volver a la lista
                    hideUserForm();
                    
                    // Refrescar lista inmediatamente
                    if (userList) {
                        userList.refresh();
                    }
                },
                onCancel: () => {
                    hideUserForm();
                }
            });
            
            if (mode === 'edit' && user) {
                userForm.setEditMode(user);
            } else {
                userForm.setCreateMode();
            }
        } catch (error) {
            console.error('❌ Error inicializando UserForm:', error);
            showError('Error al abrir el formulario de usuario');
            hideUserForm();
        }
    }
}

/**
 * Ocultar formulario de usuario
 */
function hideUserForm(): void {
    const userListContainer = document.getElementById('user-list-container');
    const userFormContainer = document.getElementById('user-form-container');
    
    if (userListContainer && userFormContainer) {
        // Mostrar lista de usuarios
        userListContainer.style.display = 'block';
        
        // Ocultar contenedor de formulario
        userFormContainer.style.display = 'none';
    }
}

/**
 * Mostrar perfil de usuario
 */
function showUserProfile(_user: User): void {
    const userListContainer = document.getElementById('user-list-container');
    const profileContainer = document.getElementById('profile-manager-container');
    
    if (userListContainer && profileContainer) {
        // Ocultar lista de usuarios
        userListContainer.style.display = 'none';
        
        // Mostrar contenedor de perfil
        profileContainer.style.display = 'block';
        
        // Inicializar ProfileManager si no existe
        if (!profileManager) {
            try {
                profileManager = new ProfileManager('profile-manager-container');
            } catch (error) {
                console.error('❌ Error inicializando ProfileManager:', error);
                showError('Error al abrir el perfil de usuario');
                hideUserProfile();
                return;
            }
        }
        
        // Refrescar el perfil para mostrar los datos del usuario
        profileManager.refresh();
    }
}

/**
 * Ocultar perfil de usuario
 */
function hideUserProfile(): void {
    const userListContainer = document.getElementById('user-list-container');
    const profileContainer = document.getElementById('profile-manager-container');
    
    if (userListContainer && profileContainer) {
        // Mostrar lista de usuarios
        userListContainer.style.display = 'block';
        
        // Ocultar contenedor de perfil
        profileContainer.style.display = 'none';
    }
}

/**
 * Inicializar el componente TaskForm
 */
function initializeTaskForm(mode: 'create' | 'edit', task?: Task): void {
    const taskFormContainer = document.getElementById('task-form-container');
    if (taskFormContainer) {
        try {
            taskForm = new TaskForm('task-form-container', {
                onSave: (savedTask: Task) => {
                    console.log('✅ Tarea guardada exitosamente:', savedTask.title);
                    
                    // Mostrar mensaje de éxito inmediatamente
                    const action = mode === 'create' ? 'creada' : 'actualizada';
                    showSuccess(`Tarea "${savedTask.title}" ${action} exitosamente`);
                    
                    // Navegar de vuelta a la lista de tareas
                    roleGuard.navigateToRoute('/tasks');
                    
                    // Actualizar TaskList si está disponible
                    setTimeout(() => {
                        if (taskList) {
                            taskList.refresh();
                        }
                    }, 300);
                },
                onCancel: () => {
                    // Navegar de vuelta a la lista de tareas
                    roleGuard.navigateToRoute('/tasks');
                }
            });
            
            if (mode === 'edit' && task) {
                taskForm.setEditMode(task);
            } else {
                taskForm.setCreateMode();
            }
            
            console.log('✅ TaskForm inicializado correctamente en modo:', mode);
        } catch (error) {
            console.error('❌ Error inicializando TaskForm:', error);
            showError('Error inicializando el formulario de tareas');
        }
    } else {
        console.log('ℹ️ Container task-form-container no encontrado, TaskForm no inicializado');
    }
}

/**
 * Obtener instancia del TaskList
 */
/**
 * Obtener instancia del TaskList
 */
export function getTaskList(): TaskList | null {
    return taskList;
}

/**
 * Obtener instancia del TaskForm
 */
export function getTaskForm(): TaskForm | null {
    return taskForm;
}

/**
 * Inicializar el componente TaskList
 */
function initializeTaskList(): void {
    console.log('🚀 Inicializando TaskList...');
    const taskListContainer = document.getElementById('task-list-container');
    if (taskListContainer) {
        try {
            taskList = new TaskList('task-list-container', {
                onViewTask: showTaskDetail,
                onEditTask: editTask,
                onUpdateTaskStatus: updateTaskStatus
            });
            console.log('✅ TaskList inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando TaskList:', error);
            showError('Error inicializando la lista de tareas');
        }
    } else {
        console.log('ℹ️ Container task-list-container no encontrado, TaskList no inicializado');
    }
}

/**
 * Inicializar el componente TaskDetail
 */
function initializeTaskDetail(): void {
    const taskDetailContainer = document.getElementById('task-detail-container');
    if (taskDetailContainer) {
        try {
            taskDetail = new TaskDetail('task-detail-container', {
                onClose: hideTaskDetail,
                onEdit: editTask,
                onStatusChange: updateTaskStatus
            });
            console.log('✅ TaskDetail inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando TaskDetail:', error);
            showError('Error inicializando los detalles de tarea');
        }
    } else {
        console.log('ℹ️ Container task-detail-container no encontrado, TaskDetail no inicializado');
    }
}

/**
 * Inicializar el componente TaskProgress
 */
function initializeTaskProgress(): void {
    const taskProgressContainer = document.getElementById('task-progress-container');
    if (taskProgressContainer) {
        try {
            taskProgress = new TaskProgress('task-progress-container', {
                onTaskUpdated: (updatedTask: Task) => {
                    console.log('✅ Tarea actualizada:', updatedTask.title);
                    
                    // Actualizar TaskList si está visible
                    if (taskList) {
                        taskList.refresh();
                    }
                    
                    // Actualizar TaskDetail si está mostrando la misma tarea
                    if (taskDetail && taskDetail.getCurrentTask()?.id === updatedTask.id) {
                        taskDetail.showTask(updatedTask);
                    }
                    
                    // Mostrar mensaje de éxito
                    showSuccess('Tarea actualizada correctamente');
                },
                onClose: () => {
                    console.log('TaskProgress cerrado');
                }
            });
            console.log('✅ TaskProgress inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando TaskProgress:', error);
            showError('Error inicializando el panel de progreso de tarea');
        }
    } else {
        console.log('ℹ️ Container task-progress-container no encontrado, TaskProgress no inicializado');
    }
}

/**
 * Mostrar detalles de una tarea
 */
function showTaskDetail(task: Task): void {
    const taskListContainer = document.getElementById('task-list-container');
    const taskDetailContainer = document.getElementById('task-detail-container');
    
    if (taskListContainer && taskDetailContainer) {
        // Ocultar lista de tareas
        taskListContainer.style.display = 'none';
        
        // Mostrar contenedor de detalles
        taskDetailContainer.style.display = 'block';
        
        // Inicializar TaskDetail si no existe
        if (!taskDetail) {
            initializeTaskDetail();
        }
        
        // Mostrar la tarea
        if (taskDetail) {
            taskDetail.showTask(task);
        }
    }
}

/**
 * Ocultar detalles de tarea y volver a la lista
 */
function hideTaskDetail(): void {
    const taskListContainer = document.getElementById('task-list-container');
    const taskDetailContainer = document.getElementById('task-detail-container');
    
    if (taskListContainer && taskDetailContainer) {
        // Mostrar lista de tareas
        taskListContainer.style.display = 'block';
        
        // Ocultar contenedor de detalles
        taskDetailContainer.style.display = 'none';
    }
}

/**
 * Editar una tarea
 */
function editTask(task: Task): void {
    console.log('Editar tarea:', task);
    
    // Crear contenedor temporal para el formulario de edición
    const editContainer = document.createElement('div');
    editContainer.id = 'edit-task-form-container';
    editContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    `;
    
    document.body.appendChild(editContainer);
    
    // Inicializar TaskForm en modo edición
    try {
        const editTaskForm = new TaskForm('edit-task-form-container', {
            onSave: (savedTask: Task) => {
                console.log('✅ Tarea editada exitosamente:', savedTask.title);
                
                // Mostrar mensaje de éxito inmediatamente
                showSuccess(`Tarea "${savedTask.title}" actualizada exitosamente`);
                
                // Cerrar modal
                document.body.removeChild(editContainer);
                
                // Refrescar lista de tareas si está visible
                setTimeout(() => {
                    if (taskList) {
                        taskList.refresh();
                    }
                }, 300);
            },
            onCancel: () => {
                // Cerrar modal
                document.body.removeChild(editContainer);
            }
        });
        
        editTaskForm.setEditMode(task);
        
    } catch (error) {
        console.error('❌ Error inicializando formulario de edición:', error);
        document.body.removeChild(editContainer);
        showError('Error al abrir el formulario de edición');
    }
}

/**
 * Actualizar estado de una tarea
 */
function updateTaskStatus(task: Task): void {
    console.log('Actualizar estado de tarea:', task);
    
    // Inicializar TaskProgress si no existe
    if (!taskProgress) {
        initializeTaskProgress();
    }
    
    // Mostrar el componente TaskProgress
    if (taskProgress) {
        taskProgress.show(task);
    } else {
        console.error('❌ Error: TaskProgress no pudo ser inicializado');
        showError('Error al abrir el panel de progreso de tarea');
    }
}