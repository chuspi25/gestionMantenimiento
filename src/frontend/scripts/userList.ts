import { User } from './types.js';
import { authManager } from './main.js';

/**
 * Componente UserList para administración de usuarios
 */
export class UserList {
    private container: HTMLElement;
    private users: User[] = [];
    private filteredUsers: User[] = [];
    private searchTerm: string = '';
    private roleFilter: string = '';
    private statusFilter: string = '';
    private isLoading: boolean = false;
    private error: string | null = null;
    private onEditUser?: (user: User) => void;
    private onCreateUser?: () => void;
    private onViewUser?: (user: User) => void;

    constructor(containerId: string, options?: {
        onEditUser?: (user: User) => void;
        onCreateUser?: () => void;
        onViewUser?: (user: User) => void;
    }) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.onEditUser = options?.onEditUser;
        this.onCreateUser = options?.onCreateUser;
        this.onViewUser = options?.onViewUser;
        this.initialize();
    }

    /**
     * Inicializar el componente
     */
    private initialize(): void {
        this.render();
        this.setupEventListeners();
        this.loadUsers();
    }

    /**
     * Renderizar la estructura del componente
     */
    private render(): void {
        this.container.innerHTML = `
            <div class="user-list-component">
                <!-- Header con controles -->
                <div class="user-list-header">
                    <div class="header-title">
                        <h2>Gestión de Usuarios</h2>
                        <button class="create-user-button" id="create-user-btn" data-permission="canCreateUsers">
                            + Crear Usuario
                        </button>
                    </div>
                    
                    <!-- Controles de búsqueda y filtros -->
                    <div class="user-controls">
                        <div class="search-section">
                            <div class="search-input-container">
                                <input 
                                    type="text" 
                                    id="user-search" 
                                    class="search-input" 
                                    placeholder="Buscar por nombre, email o rol..."
                                    value="${this.searchTerm}"
                                >
                                <button 
                                    id="clear-search" 
                                    class="clear-search-button" 
                                    title="Limpiar búsqueda"
                                    style="display: ${this.searchTerm ? 'flex' : 'none'}"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        
                        <div class="filters-section">
                            <div class="filter-group">
                                <label for="filter-role">Rol</label>
                                <select id="filter-role" class="filter-select">
                                    <option value="">Todos los roles</option>
                                    <option value="operator">Operador</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label for="filter-status">Estado</label>
                                <select id="filter-status" class="filter-select">
                                    <option value="">Todos los estados</option>
                                    <option value="active">Activo</option>
                                    <option value="inactive">Inactivo</option>
                                </select>
                            </div>
                            
                            <button id="clear-filters" class="clear-filters-button">
                                Limpiar Filtros
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Lista de usuarios -->
                <div class="user-list-container">
                    <div class="user-list-stats">
                        <span id="user-count-text">0 usuarios</span>
                    </div>
                    
                    <div id="user-list-content" class="user-list-content">
                        <!-- El contenido se renderizará aquí -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configurar event listeners
     */
    private setupEventListeners(): void {
        // Búsqueda
        const searchInput = document.getElementById('user-search') as HTMLInputElement;
        const clearSearchButton = document.getElementById('clear-search') as HTMLButtonElement;
        
        searchInput?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.searchTerm = target.value;
            this.updateSearch();
            this.applyFilters();
        });
        
        clearSearchButton?.addEventListener('click', () => {
            this.searchTerm = '';
            searchInput.value = '';
            this.updateSearch();
            this.applyFilters();
        });

        // Filtros
        const roleFilter = document.getElementById('filter-role') as HTMLSelectElement;
        const statusFilter = document.getElementById('filter-status') as HTMLSelectElement;
        
        roleFilter?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.roleFilter = target.value;
            this.applyFilters();
        });
        
        statusFilter?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.statusFilter = target.value;
            this.applyFilters();
        });

        // Limpiar filtros
        const clearFiltersButton = document.getElementById('clear-filters') as HTMLButtonElement;
        clearFiltersButton?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Crear usuario
        const createUserButton = document.getElementById('create-user-btn') as HTMLButtonElement;
        createUserButton?.addEventListener('click', () => {
            if (this.onCreateUser) {
                this.onCreateUser();
            }
        });
    }

    /**
     * Cargar usuarios desde la API
     */
    private async loadUsers(): Promise<void> {
        console.log('🔄 UserList: Iniciando carga de usuarios...');
        this.setLoading(true);
        this.error = null;

        try {
            // Esperar a que el token esté disponible
            await this.waitForToken();
            
            const token = authManager.getToken();
            console.log('🔑 UserList: Token disponible:', !!token);
            
            if (!token) {
                throw new Error('Token de autenticación no disponible');
            }

            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 UserList: Respuesta recibida:', response.status);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 UserList: Datos recibidos:', data);
            this.users = data.data?.users || [];
            console.log('👥 UserList: Usuarios cargados:', this.users.length);
            this.applyFilters();
            
        } catch (error) {
            console.error('❌ UserList: Error cargando usuarios:', error);
            this.error = error instanceof Error ? error.message : 'Error desconocido';
            this.renderError();
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Esperar a que el token esté disponible
     */
    private async waitForToken(maxAttempts: number = 30): Promise<void> {
        console.log('🔄 UserList: Esperando token de autenticación...');
        
        for (let i = 0; i < maxAttempts; i++) {
            const token = authManager.getToken();
            const isAuthenticated = authManager.isAuthenticated();
            
            console.log(`🔄 UserList: Intento ${i + 1}/${maxAttempts} - Token: ${!!token}, Auth: ${isAuthenticated}`);
            
            if (token && isAuthenticated) {
                console.log('✅ UserList: Token y autenticación confirmados');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.error('❌ UserList: Timeout esperando token de autenticación');
        throw new Error('Timeout esperando token de autenticación');
    }

    /**
     * Aplicar filtros de búsqueda
     */
    private applyFilters(): void {
        let filtered = [...this.users];

        // Aplicar búsqueda
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(user => 
                user.name.toLowerCase().includes(searchLower) ||
                user.email.toLowerCase().includes(searchLower) ||
                this.getRoleLabel(user.role).toLowerCase().includes(searchLower)
            );
        }

        // Aplicar filtro de rol
        if (this.roleFilter) {
            filtered = filtered.filter(user => user.role === this.roleFilter);
        }

        // Aplicar filtro de estado
        if (this.statusFilter) {
            const isActive = this.statusFilter === 'active';
            filtered = filtered.filter(user => user.isActive === isActive);
        }

        this.filteredUsers = filtered;
        this.renderUsers();
        this.updateUserCount();
    }

    /**
     * Renderizar usuarios
     */
    private renderUsers(): void {
        const content = document.getElementById('user-list-content');
        if (!content) return;

        if (this.isLoading) {
            this.renderLoading();
            return;
        }

        if (this.error) {
            this.renderError();
            return;
        }

        if (this.filteredUsers.length === 0) {
            this.renderEmpty();
            return;
        }

        content.innerHTML = `
            <div class="user-table">
                <div class="user-table-header">
                    <div class="header-cell name-cell">Nombre</div>
                    <div class="header-cell email-cell">Email</div>
                    <div class="header-cell role-cell">Rol</div>
                    <div class="header-cell status-cell">Estado</div>
                    <div class="header-cell date-cell">Último acceso</div>
                    <div class="header-cell actions-cell">Acciones</div>
                </div>
                <div class="user-table-body">
                    ${this.filteredUsers.map(user => this.renderUserRow(user)).join('')}
                </div>
            </div>
        `;

        this.setupUserEventListeners();
    }

    /**
     * Renderizar fila de usuario
     */
    private renderUserRow(user: User): string {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
        const createdDate = new Date(user.createdAt);
        const statusClass = user.isActive ? 'active' : 'inactive';
        const roleClass = `role-${user.role}`;

        return `
            <div class="user-row ${statusClass}" data-user-id="${user.id}">
                <div class="user-cell name-cell">
                    <div class="user-avatar">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.escapeHtml(user.name)}</div>
                        <div class="user-id">ID: ${user.id}</div>
                    </div>
                </div>
                
                <div class="user-cell email-cell">
                    <span class="user-email">${this.escapeHtml(user.email)}</span>
                </div>
                
                <div class="user-cell role-cell">
                    <span class="role-badge ${roleClass}">
                        ${this.getRoleLabel(user.role)}
                    </span>
                </div>
                
                <div class="user-cell status-cell">
                    <span class="status-badge ${statusClass}">
                        <span class="status-indicator"></span>
                        ${user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                
                <div class="user-cell date-cell">
                    <div class="date-info">
                        ${lastLogin ? `
                            <div class="last-login">
                                ${lastLogin.toLocaleDateString()}
                            </div>
                            <div class="last-login-time">
                                ${lastLogin.toLocaleTimeString()}
                            </div>
                        ` : `
                            <div class="no-login">Nunca</div>
                            <div class="created-date">
                                Creado: ${createdDate.toLocaleDateString()}
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="user-cell actions-cell">
                    <div class="user-actions">
                        <button class="action-button view-button" data-action="view" data-user-id="${user.id}" title="Ver detalles">
                            👁️
                        </button>
                        <button class="action-button edit-button" data-action="edit" data-user-id="${user.id}" data-permission="canEditUsers" title="Editar">
                            ✏️
                        </button>
                        <button class="action-button ${user.isActive ? 'deactivate' : 'activate'}-button" 
                                data-action="${user.isActive ? 'deactivate' : 'activate'}" 
                                data-user-id="${user.id}" 
                                data-permission="canManageUsers"
                                title="${user.isActive ? 'Desactivar' : 'Activar'}">
                            ${user.isActive ? '🚫' : '✅'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configurar event listeners para usuarios
     */
    private setupUserEventListeners(): void {
        const actionButtons = document.querySelectorAll('.action-button');
        
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const action = target.dataset.action;
                const userId = target.dataset.userId;
                
                if (action && userId) {
                    this.handleUserAction(action, userId);
                }
            });
        });
    }

    /**
     * Manejar acciones de usuario
     */
    private async handleUserAction(action: string, userId: string): Promise<void> {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        switch (action) {
            case 'view':
                if (this.onViewUser) {
                    this.onViewUser(user);
                } else {
                    this.viewUserDetails(user);
                }
                break;
                
            case 'edit':
                if (this.onEditUser) {
                    this.onEditUser(user);
                } else {
                    this.editUser(user);
                }
                break;
                
            case 'activate':
            case 'deactivate':
                await this.toggleUserStatus(user);
                break;
        }
    }

    /**
     * Ver detalles de usuario
     */
    private viewUserDetails(user: User): void {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Nunca';
        const createdDate = new Date(user.createdAt).toLocaleString();
        
        alert(`Detalles del Usuario:
        
Nombre: ${user.name}
Email: ${user.email}
Rol: ${this.getRoleLabel(user.role)}
Estado: ${user.isActive ? 'Activo' : 'Inactivo'}
Último acceso: ${lastLogin}
Fecha de creación: ${createdDate}`);
    }

    /**
     * Editar usuario
     */
    private editUser(user: User): void {
        console.log('Editar usuario:', user);
        alert(`Editar usuario: ${user.name}\n\nEsta funcionalidad se implementará en la siguiente fase.`);
    }

    /**
     * Cambiar estado de usuario
     */
    private async toggleUserStatus(user: User): Promise<void> {
        const newStatus = !user.isActive;
        const action = newStatus ? 'activar' : 'desactivar';
        
        if (!confirm(`¿Está seguro de que desea ${action} al usuario ${user.name}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${user.id}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: newStatus })
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Actualizar usuario local
            user.isActive = newStatus;
            this.applyFilters();
            
            // Mostrar mensaje de éxito
            this.showMessage(`Usuario ${action} exitosamente`, 'success');
            
        } catch (error) {
            console.error('Error cambiando estado del usuario:', error);
            this.showMessage(`Error al ${action} usuario`, 'error');
        }
    }

    /**
     * Actualizar visibilidad del botón de limpiar búsqueda
     */
    private updateSearch(): void {
        const clearSearchButton = document.getElementById('clear-search') as HTMLButtonElement;
        if (clearSearchButton) {
            clearSearchButton.style.display = this.searchTerm ? 'flex' : 'none';
        }
    }

    /**
     * Limpiar filtros
     */
    private clearFilters(): void {
        this.searchTerm = '';
        this.roleFilter = '';
        this.statusFilter = '';
        
        // Limpiar controles
        const searchInput = document.getElementById('user-search') as HTMLInputElement;
        const roleSelect = document.getElementById('filter-role') as HTMLSelectElement;
        const statusSelect = document.getElementById('filter-status') as HTMLSelectElement;
        
        if (searchInput) searchInput.value = '';
        if (roleSelect) roleSelect.value = '';
        if (statusSelect) statusSelect.value = '';
        
        this.updateSearch();
        this.applyFilters();
    }

    /**
     * Renderizar estado de carga
     */
    private renderLoading(): void {
        const content = document.getElementById('user-list-content');
        if (!content) return;

        content.innerHTML = `
            <div class="user-list-loading">
                <div class="loading-spinner"></div>
                <p>Cargando usuarios...</p>
            </div>
        `;
    }

    /**
     * Renderizar estado vacío
     */
    private renderEmpty(): void {
        const content = document.getElementById('user-list-content');
        if (!content) return;

        const hasFilters = this.searchTerm || this.roleFilter || this.statusFilter;

        content.innerHTML = `
            <div class="user-list-empty">
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>${hasFilters ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}</h3>
                    <p>
                        ${hasFilters 
                            ? 'Intenta ajustar los filtros de búsqueda para encontrar más usuarios.'
                            : 'Aún no hay usuarios registrados en el sistema. Crea el primer usuario para comenzar.'
                        }
                    </p>
                    ${!hasFilters ? `
                        <button class="create-first-user-button" onclick="document.getElementById('create-user-btn').click()">
                            Crear Primer Usuario
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Renderizar estado de error
     */
    private renderError(): void {
        const content = document.getElementById('user-list-content');
        if (!content) return;

        content.innerHTML = `
            <div class="user-list-error">
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>Error al cargar usuarios</h3>
                    <p>${this.error || 'Ocurrió un error inesperado al cargar los usuarios.'}</p>
                    <button class="retry-button" onclick="this.loadUsers()">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Establecer estado de carga
     */
    private setLoading(loading: boolean): void {
        this.isLoading = loading;
        if (loading) {
            this.renderLoading();
        }
    }

    /**
     * Actualizar contador de usuarios
     */
    private updateUserCount(): void {
        const countElement = document.getElementById('user-count-text');
        if (countElement) {
            const count = this.filteredUsers.length;
            const total = this.users.length;
            
            if (count === total) {
                countElement.textContent = `${count} usuario${count !== 1 ? 's' : ''}`;
            } else {
                countElement.textContent = `${count} de ${total} usuario${total !== 1 ? 's' : ''}`;
            }
        }
    }

    /**
     * Obtener etiqueta de rol
     */
    private getRoleLabel(role: string): string {
        const labels = {
            'operator': 'Operador',
            'supervisor': 'Supervisor',
            'admin': 'Administrador'
        };
        return labels[role as keyof typeof labels] || role;
    }

    /**
     * Escapar HTML para prevenir XSS
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Mostrar mensaje
     */
    private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
        // Crear elemento de mensaje
        const messageElement = document.createElement('div');
        messageElement.className = `user-message ${type}`;
        messageElement.innerHTML = `
            <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="message-text">${message}</span>
        `;

        // Agregar al contenedor
        this.container.insertBefore(messageElement, this.container.firstChild);

        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }

    /**
     * Refrescar la lista de usuarios
     */
    public refresh(): void {
        console.log('🔄 UserList: Refrescando lista de usuarios...');
        this.loadUsers();
    }

    /**
     * Refrescar la lista de usuarios con delay
     */
    public refreshWithDelay(delay: number = 500): void {
        console.log(`🔄 UserList: Refrescando lista de usuarios con delay de ${delay}ms...`);
        setTimeout(() => {
            this.loadUsers();
        }, delay);
    }

    /**
     * Obtener usuarios filtrados
     */
    public getFilteredUsers(): User[] {
        return [...this.filteredUsers];
    }
}