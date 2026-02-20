import { authManager } from './main.js';
/**
 * Componente TaskList para gestión de tareas con filtrado y ordenamiento
 */
export class TaskList {
    container;
    tasks = [];
    filteredTasks = [];
    currentFilters = {};
    currentSort = { field: 'dueDate', direction: 'asc' };
    currentView = 'grid';
    searchTerm = '';
    isLoading = false;
    error = null;
    onViewTask;
    onEditTask;
    onUpdateTaskStatus;
    constructor(containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.onViewTask = options?.onViewTask;
        this.onEditTask = options?.onEditTask;
        this.onUpdateTaskStatus = options?.onUpdateTaskStatus;
        this.initialize();
    }
    /**
     * Inicializar el componente
     */
    initialize() {
        this.render();
        this.setupEventListeners();
        this.loadTasks();
    }
    /**
     * Renderizar la estructura del componente
     */
    render() {
        this.container.innerHTML = `
            <div class="task-list-component">
                <!-- Controles de búsqueda y filtros -->
                <div class="task-controls">
                    <div class="search-section">
                        <div class="search-input-container">
                            <input 
                                type="text" 
                                id="task-search" 
                                class="search-input" 
                                placeholder="Buscar tareas por título, descripción o ubicación..."
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
                            <label for="filter-type">Tipo</label>
                            <select id="filter-type" class="filter-select">
                                <option value="">Todos los tipos</option>
                                <option value="electrical">Eléctrico</option>
                                <option value="mechanical">Mecánico</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-status">Estado</label>
                            <select id="filter-status" class="filter-select">
                                <option value="">Todos los estados</option>
                                <option value="pending">Pendiente</option>
                                <option value="in_progress">En Progreso</option>
                                <option value="completed">Completada</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-priority">Prioridad</label>
                            <select id="filter-priority" class="filter-select">
                                <option value="">Todas las prioridades</option>
                                <option value="urgent">Urgente</option>
                                <option value="high">Alta</option>
                                <option value="medium">Media</option>
                                <option value="low">Baja</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="filter-assigned">Asignado a</label>
                            <select id="filter-assigned" class="filter-select">
                                <option value="">Todos los usuarios</option>
                                <option value="me">Mis tareas</option>
                                <option value="unassigned">Sin asignar</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="sort-by">Ordenar por</label>
                            <select id="sort-by" class="filter-select">
                                <option value="dueDate">Fecha límite</option>
                                <option value="priority">Prioridad</option>
                                <option value="createdAt">Fecha de creación</option>
                                <option value="title">Título</option>
                                <option value="status">Estado</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="sort-direction">Dirección</label>
                            <select id="sort-direction" class="filter-select">
                                <option value="asc">Ascendente</option>
                                <option value="desc">Descendente</option>
                            </select>
                        </div>
                        
                        <button id="clear-filters" class="clear-filters-button">
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
                
                <!-- Lista de tareas -->
                <div class="task-list-container">
                    <div class="task-list-header">
                        <div class="task-count">
                            <span id="task-count-text">0 tareas</span>
                        </div>
                        <div class="view-options">
                            <button 
                                id="view-grid" 
                                class="view-button ${this.currentView === 'grid' ? 'active' : ''}"
                                title="Vista de cuadrícula"
                            >
                                ⊞
                            </button>
                            <button 
                                id="view-list" 
                                class="view-button ${this.currentView === 'list' ? 'active' : ''}"
                                title="Vista de lista"
                            >
                                ☰
                            </button>
                        </div>
                    </div>
                    
                    <div id="task-list-content" class="task-list-content view-${this.currentView}">
                        <!-- El contenido se renderizará aquí -->
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Búsqueda
        const searchInput = document.getElementById('task-search');
        const clearSearchButton = document.getElementById('clear-search');
        searchInput?.addEventListener('input', (e) => {
            const target = e.target;
            this.searchTerm = target.value;
            this.updateSearch();
            this.applyFiltersAndSort();
        });
        clearSearchButton?.addEventListener('click', () => {
            this.searchTerm = '';
            searchInput.value = '';
            this.updateSearch();
            this.applyFiltersAndSort();
        });
        // Filtros
        const filterType = document.getElementById('filter-type');
        const filterStatus = document.getElementById('filter-status');
        const filterPriority = document.getElementById('filter-priority');
        const filterAssigned = document.getElementById('filter-assigned');
        filterType?.addEventListener('change', (e) => {
            const target = e.target;
            this.currentFilters.type = target.value || undefined;
            this.applyFiltersAndSort();
        });
        filterStatus?.addEventListener('change', (e) => {
            const target = e.target;
            this.currentFilters.status = target.value || undefined;
            this.applyFiltersAndSort();
        });
        filterPriority?.addEventListener('change', (e) => {
            const target = e.target;
            this.currentFilters.priority = target.value || undefined;
            this.applyFiltersAndSort();
        });
        filterAssigned?.addEventListener('change', (e) => {
            const target = e.target;
            const value = target.value;
            if (value === 'me') {
                const currentUser = authManager.getCurrentUser();
                this.currentFilters.assignedTo = currentUser?.id;
            }
            else if (value === 'unassigned') {
                this.currentFilters.assignedTo = null;
            }
            else {
                this.currentFilters.assignedTo = undefined;
            }
            this.applyFiltersAndSort();
        });
        // Ordenamiento
        const sortBy = document.getElementById('sort-by');
        const sortDirection = document.getElementById('sort-direction');
        sortBy?.addEventListener('change', (e) => {
            const target = e.target;
            this.currentSort.field = target.value;
            this.applyFiltersAndSort();
        });
        sortDirection?.addEventListener('change', (e) => {
            const target = e.target;
            this.currentSort.direction = target.value;
            this.applyFiltersAndSort();
        });
        // Limpiar filtros
        const clearFiltersButton = document.getElementById('clear-filters');
        clearFiltersButton?.addEventListener('click', () => {
            this.clearFilters();
        });
        // Vista
        const viewGridButton = document.getElementById('view-grid');
        const viewListButton = document.getElementById('view-list');
        viewGridButton?.addEventListener('click', () => {
            this.setView('grid');
        });
        viewListButton?.addEventListener('click', () => {
            this.setView('list');
        });
    }
    /**
     * Actualizar la visibilidad del botón de limpiar búsqueda
     */
    updateSearch() {
        const clearSearchButton = document.getElementById('clear-search');
        if (clearSearchButton) {
            clearSearchButton.style.display = this.searchTerm ? 'flex' : 'none';
        }
    }
    /**
     * Cargar tareas desde la API
     */
    async loadTasks() {
        console.log('🔄 TaskList: Iniciando carga de tareas...');
        this.setLoading(true);
        this.error = null;
        try {
            // Esperar a que el token esté disponible
            await this.waitForToken();
            const token = authManager.getToken();
            console.log('🔑 TaskList: Token disponible:', !!token);
            if (!token) {
                throw new Error('Token de autenticación no disponible');
            }
            const response = await fetch('/api/tasks', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('📡 TaskList: Respuesta recibida:', response.status);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log('📊 TaskList: Datos recibidos:', data);
            this.tasks = data.data?.items || [];
            console.log('📋 TaskList: Tareas cargadas:', this.tasks.length);
            this.applyFiltersAndSort();
        }
        catch (error) {
            console.error('❌ TaskList: Error cargando tareas:', error);
            this.error = error instanceof Error ? error.message : 'Error desconocido';
            this.renderError();
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Esperar a que el token esté disponible
     */
    async waitForToken(maxAttempts = 10) {
        console.log('🔄 TaskList: Esperando token de autenticación...');
        for (let i = 0; i < maxAttempts; i++) {
            const token = authManager.getToken();
            const isAuthenticated = authManager.isAuthenticated();
            console.log(`🔄 TaskList: Intento ${i + 1}/${maxAttempts} - Token: ${!!token}, Auth: ${isAuthenticated}`);
            if (token && isAuthenticated) {
                console.log('✅ TaskList: Token y autenticación confirmados');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.warn('⚠️ TaskList: Timeout esperando token, continuando con token actual');
        // No lanzar error, continuar con lo que haya
    }
    /**
     * Aplicar filtros y ordenamiento
     */
    applyFiltersAndSort() {
        let filtered = [...this.tasks];
        // Aplicar búsqueda
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(task => task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                task.location.toLowerCase().includes(searchLower));
        }
        // Aplicar filtros
        if (this.currentFilters.type) {
            filtered = filtered.filter(task => task.type === this.currentFilters.type);
        }
        if (this.currentFilters.status) {
            filtered = filtered.filter(task => task.status === this.currentFilters.status);
        }
        if (this.currentFilters.priority) {
            filtered = filtered.filter(task => task.priority === this.currentFilters.priority);
        }
        if (this.currentFilters.assignedTo !== undefined) {
            if (this.currentFilters.assignedTo === null) {
                // Sin asignar
                filtered = filtered.filter(task => !task.assignedTo);
            }
            else {
                // Asignado a usuario específico
                filtered = filtered.filter(task => task.assignedTo === this.currentFilters.assignedTo);
            }
        }
        // Aplicar ordenamiento
        filtered.sort((a, b) => {
            const field = this.currentSort.field;
            const direction = this.currentSort.direction === 'asc' ? 1 : -1;
            let aValue = a[field];
            let bValue = b[field];
            // Manejo especial para fechas
            if (field === 'dueDate' || field === 'createdAt') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }
            // Manejo especial para prioridades
            if (field === 'priority') {
                const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
                aValue = priorityOrder[aValue] || 0;
                bValue = priorityOrder[bValue] || 0;
            }
            if (aValue != null && bValue != null) {
                if (aValue < bValue)
                    return -1 * direction;
                if (aValue > bValue)
                    return 1 * direction;
            }
            return 0;
        });
        this.filteredTasks = filtered;
        this.renderTasks();
        this.updateTaskCount();
    }
    /**
     * Renderizar las tareas
     */
    renderTasks() {
        const content = document.getElementById('task-list-content');
        if (!content)
            return;
        if (this.isLoading) {
            this.renderLoading();
            return;
        }
        if (this.error) {
            this.renderError();
            return;
        }
        if (this.filteredTasks.length === 0) {
            this.renderEmpty();
            return;
        }
        content.innerHTML = this.filteredTasks.map(task => this.renderTaskCard(task)).join('');
        this.setupTaskEventListeners();
    }
    /**
     * Renderizar una tarjeta de tarea
     */
    renderTaskCard(task) {
        const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';
        const dueDate = new Date(task.dueDate);
        const createdDate = new Date(task.createdAt);
        const priorityClass = `priority-${task.priority}`;
        const statusClass = `status-${task.status}`;
        const typeClass = `type-${task.type}`;
        const toolsList = task.requiredTools && task.requiredTools.length > 0
            ? task.requiredTools.map(tool => `<span class="tool-tag">${tool}</span>`).join('')
            : '<span class="tool-tag">Sin herramientas</span>';
        return `
            <div class="task-card ${priorityClass} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="priority-badge ${priorityClass}">
                        ${this.getPriorityLabel(task.priority)}
                    </div>
                    <div class="status-badge ${statusClass}">
                        ${this.getStatusLabel(task.status)}
                    </div>
                </div>
                
                <div class="task-card-content">
                    <h3 class="task-title">${this.escapeHtml(task.title)}</h3>
                    <p class="task-description">${this.escapeHtml(task.description)}</p>
                    
                    <div class="task-meta">
                        <div class="task-meta-item">
                            <span class="meta-label">Tipo</span>
                            <span class="meta-value ${typeClass}">
                                ${this.getTypeLabel(task.type)}
                            </span>
                        </div>
                        
                        <div class="task-meta-item">
                            <span class="meta-label">Ubicación</span>
                            <span class="meta-value">${this.escapeHtml(task.location)}</span>
                        </div>
                        
                        <div class="task-meta-item">
                            <span class="meta-label">Fecha límite</span>
                            <span class="meta-value ${isOverdue ? 'overdue' : ''}">
                                ${dueDate.toLocaleDateString()}
                            </span>
                        </div>
                        
                        <div class="task-meta-item">
                            <span class="meta-label">Duración estimada</span>
                            <span class="meta-value">${task.estimatedDuration} min</span>
                        </div>
                        
                        <div class="task-meta-item">
                            <span class="meta-label">Creada</span>
                            <span class="meta-value">${createdDate.toLocaleDateString()}</span>
                        </div>
                        
                        <div class="task-meta-item">
                            <span class="meta-label">Asignada a</span>
                            <span class="meta-value">
                                ${task.assignedTo ? 'Usuario asignado' : 'Sin asignar'}
                            </span>
                        </div>
                    </div>
                    
                    ${task.requiredTools && task.requiredTools.length > 0 ? `
                        <div class="task-tools">
                            <span class="meta-label">Herramientas requeridas</span>
                            <div class="tools-list">
                                ${toolsList}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="task-card-actions">
                    <button class="task-action-button view-button" data-action="view" data-task-id="${task.id}">
                        Ver Detalles
                    </button>
                    <button class="task-action-button edit-button" data-action="edit" data-task-id="${task.id}" data-permission="canEditTasks">
                        Editar
                    </button>
                    <button class="task-action-button status-button" data-action="status" data-task-id="${task.id}" data-permission="canUpdateTaskStatus">
                        Cambiar Estado
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners para las tareas
     */
    setupTaskEventListeners() {
        const actionButtons = document.querySelectorAll('.task-action-button');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target;
                const action = target.dataset.action;
                const taskId = target.dataset.taskId;
                if (action && taskId) {
                    this.handleTaskAction(action, taskId);
                }
            });
        });
    }
    /**
     * Manejar acciones de tarea
     */
    handleTaskAction(action, taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task)
            return;
        switch (action) {
            case 'view':
                if (this.onViewTask) {
                    this.onViewTask(task);
                }
                else {
                    this.viewTaskDetails(task);
                }
                break;
            case 'edit':
                if (this.onEditTask) {
                    this.onEditTask(task);
                }
                else {
                    this.editTask(task);
                }
                break;
            case 'status':
                if (this.onUpdateTaskStatus) {
                    this.onUpdateTaskStatus(task);
                }
                else {
                    this.updateTaskStatus(task);
                }
                break;
        }
    }
    /**
     * Ver detalles de tarea
     */
    viewTaskDetails(task) {
        // Implementar modal o navegación a página de detalles
        console.log('Ver detalles de tarea:', task);
        alert(`Detalles de tarea: ${task.title}\n\nEsta funcionalidad se implementará en la siguiente fase.`);
    }
    /**
     * Editar tarea
     */
    editTask(task) {
        // Implementar navegación a formulario de edición
        console.log('Editar tarea:', task);
        alert(`Editar tarea: ${task.title}\n\nEsta funcionalidad se implementará en la siguiente fase.`);
    }
    /**
     * Actualizar estado de tarea
     */
    updateTaskStatus(task) {
        // Implementar modal de cambio de estado
        console.log('Cambiar estado de tarea:', task);
        alert(`Cambiar estado de tarea: ${task.title}\n\nEsta funcionalidad se implementará en la siguiente fase.`);
    }
    /**
     * Renderizar estado de carga
     */
    renderLoading() {
        const content = document.getElementById('task-list-content');
        if (!content)
            return;
        content.innerHTML = `
            <div class="task-list-loading">
                <div class="loading-spinner"></div>
                <p>Cargando tareas...</p>
            </div>
        `;
    }
    /**
     * Renderizar estado vacío
     */
    renderEmpty() {
        const content = document.getElementById('task-list-content');
        if (!content)
            return;
        const hasFilters = this.searchTerm ||
            Object.values(this.currentFilters).some(value => value !== undefined);
        content.innerHTML = `
            <div class="task-list-empty">
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>${hasFilters ? 'No se encontraron tareas' : 'No hay tareas disponibles'}</h3>
                    <p>
                        ${hasFilters
            ? 'Intenta ajustar los filtros de búsqueda para encontrar más tareas.'
            : 'Aún no hay tareas creadas en el sistema. Crea la primera tarea para comenzar.'}
                    </p>
                </div>
            </div>
        `;
    }
    /**
     * Renderizar estado de error
     */
    renderError() {
        const content = document.getElementById('task-list-content');
        if (!content)
            return;
        content.innerHTML = `
            <div class="task-list-error">
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>Error al cargar tareas</h3>
                    <p>${this.error || 'Ocurrió un error inesperado al cargar las tareas.'}</p>
                    <button class="retry-button" onclick="this.loadTasks()">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Establecer estado de carga
     */
    setLoading(loading) {
        this.isLoading = loading;
        if (loading) {
            this.renderLoading();
        }
    }
    /**
     * Actualizar contador de tareas
     */
    updateTaskCount() {
        const countElement = document.getElementById('task-count-text');
        if (countElement) {
            const count = this.filteredTasks.length;
            const total = this.tasks.length;
            if (count === total) {
                countElement.textContent = `${count} tarea${count !== 1 ? 's' : ''}`;
            }
            else {
                countElement.textContent = `${count} de ${total} tarea${total !== 1 ? 's' : ''}`;
            }
        }
    }
    /**
     * Cambiar vista
     */
    setView(view) {
        this.currentView = view;
        // Actualizar botones
        const gridButton = document.getElementById('view-grid');
        const listButton = document.getElementById('view-list');
        gridButton?.classList.toggle('active', view === 'grid');
        listButton?.classList.toggle('active', view === 'list');
        // Actualizar contenedor
        const content = document.getElementById('task-list-content');
        if (content) {
            content.className = `task-list-content view-${view}`;
        }
    }
    /**
     * Limpiar filtros
     */
    clearFilters() {
        this.currentFilters = {};
        this.searchTerm = '';
        // Limpiar controles
        const searchInput = document.getElementById('task-search');
        const filterType = document.getElementById('filter-type');
        const filterStatus = document.getElementById('filter-status');
        const filterPriority = document.getElementById('filter-priority');
        const filterAssigned = document.getElementById('filter-assigned');
        if (searchInput)
            searchInput.value = '';
        if (filterType)
            filterType.value = '';
        if (filterStatus)
            filterStatus.value = '';
        if (filterPriority)
            filterPriority.value = '';
        if (filterAssigned)
            filterAssigned.value = '';
        this.updateSearch();
        this.applyFiltersAndSort();
    }
    /**
     * Obtener etiqueta de prioridad
     */
    getPriorityLabel(priority) {
        const labels = {
            'urgent': 'Urgente',
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        };
        return labels[priority] || priority;
    }
    /**
     * Obtener etiqueta de estado
     */
    getStatusLabel(status) {
        const labels = {
            'pending': 'Pendiente',
            'in_progress': 'En Progreso',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };
        return labels[status] || status;
    }
    /**
     * Obtener etiqueta de tipo
     */
    getTypeLabel(type) {
        const labels = {
            'electrical': 'Eléctrico',
            'mechanical': 'Mecánico'
        };
        return labels[type] || type;
    }
    /**
     * Escapar HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    /**
     * Refrescar la lista de tareas
     */
    refresh() {
        this.loadTasks();
    }
    /**
     * Obtener tareas filtradas
     */
    getFilteredTasks() {
        return [...this.filteredTasks];
    }
    /**
     * Obtener filtros actuales
     */
    getCurrentFilters() {
        return { ...this.currentFilters };
    }
    /**
     * Establecer filtros
     */
    setFilters(filters) {
        this.currentFilters = { ...filters };
        this.applyFiltersAndSort();
    }
}
