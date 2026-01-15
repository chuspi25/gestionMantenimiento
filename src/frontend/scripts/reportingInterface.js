import { authManager } from './main.js';
/**
 * Componente ReportingInterface para generación y visualización de reportes
 */
export class ReportingInterface {
    container;
    filters;
    reportData = null;
    isLoading = false;
    error = null;
    users = [];
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.filters = this.getDefaultFilters();
        this.initialize();
    }
    /**
     * Inicializar el componente
     */
    initialize() {
        this.render();
        this.setupEventListeners();
        this.loadUsers();
    }
    /**
     * Obtener filtros por defecto
     */
    getDefaultFilters() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1); // Último mes por defecto
        return {
            dateRange: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            },
            status: [],
            priority: [],
            type: [],
            assignedTo: [],
            createdBy: []
        };
    }
    /**
     * Renderizar la estructura del componente
     */
    render() {
        this.container.innerHTML = `
            <div class="reporting-interface-component">
                <!-- Header -->
                <div class="reporting-header">
                    <h2 class="reporting-title">Generación de Reportes</h2>
                    <div class="header-actions">
                        <button class="export-button" id="export-pdf" title="Exportar a PDF">
                            📄 PDF
                        </button>
                        <button class="export-button" id="export-excel" title="Exportar a Excel">
                            📊 Excel
                        </button>
                        <button class="export-button" id="export-csv" title="Exportar a CSV">
                            📋 CSV
                        </button>
                    </div>
                </div>

                <!-- Filtros -->
                <div class="reporting-filters">
                    <div class="filters-header">
                        <h3>Filtros del Reporte</h3>
                        <div class="filter-actions">
                            <button class="clear-filters-btn" id="clear-filters">Limpiar</button>
                            <button class="apply-filters-btn" id="apply-filters">Generar Reporte</button>
                        </div>
                    </div>
                    
                    <div class="filters-content">
                        <!-- Rango de fechas -->
                        <div class="filter-section">
                            <h4>Rango de Fechas</h4>
                            <div class="date-range-inputs">
                                <div class="date-input-group">
                                    <label for="start-date">Fecha de inicio</label>
                                    <input type="date" id="start-date" value="${this.filters.dateRange.startDate}">
                                </div>
                                <div class="date-input-group">
                                    <label for="end-date">Fecha de fin</label>
                                    <input type="date" id="end-date" value="${this.filters.dateRange.endDate}">
                                </div>
                            </div>
                            <div class="date-presets">
                                <button class="preset-btn" data-preset="week">Última semana</button>
                                <button class="preset-btn" data-preset="month">Último mes</button>
                                <button class="preset-btn" data-preset="quarter">Último trimestre</button>
                                <button class="preset-btn" data-preset="year">Último año</button>
                            </div>
                        </div>

                        <!-- Filtros de estado -->
                        <div class="filter-section">
                            <h4>Estado de Tareas</h4>
                            <div class="checkbox-group" id="status-filters">
                                <label class="checkbox-label">
                                    <input type="checkbox" value="pending">
                                    <span>Pendientes</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="in_progress">
                                    <span>En Progreso</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="completed">
                                    <span>Completadas</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="cancelled">
                                    <span>Canceladas</span>
                                </label>
                            </div>
                        </div>

                        <!-- Filtros de prioridad -->
                        <div class="filter-section">
                            <h4>Prioridad</h4>
                            <div class="checkbox-group" id="priority-filters">
                                <label class="checkbox-label">
                                    <input type="checkbox" value="low">
                                    <span>Baja</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="medium">
                                    <span>Media</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="high">
                                    <span>Alta</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="critical">
                                    <span>Crítica</span>
                                </label>
                            </div>
                        </div>

                        <!-- Filtros de tipo -->
                        <div class="filter-section">
                            <h4>Tipo de Mantenimiento</h4>
                            <div class="checkbox-group" id="type-filters">
                                <label class="checkbox-label">
                                    <input type="checkbox" value="preventive">
                                    <span>Preventivo</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="corrective">
                                    <span>Correctivo</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="emergency">
                                    <span>Emergencia</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" value="inspection">
                                    <span>Inspección</span>
                                </label>
                            </div>
                        </div>

                        <!-- Filtros de usuarios -->
                        <div class="filter-section">
                            <h4>Usuarios</h4>
                            <div class="user-filters">
                                <div class="user-filter-group">
                                    <label for="assigned-to-select">Asignado a</label>
                                    <select id="assigned-to-select" multiple>
                                        <option value="">Todos los usuarios</option>
                                    </select>
                                </div>
                                <div class="user-filter-group">
                                    <label for="created-by-select">Creado por</label>
                                    <select id="created-by-select" multiple>
                                        <option value="">Todos los usuarios</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contenido del reporte -->
                <div class="reporting-content" id="reporting-content">
                    ${this.renderReportContent()}
                </div>
            </div>
        `;
    }
    /**
     * Renderizar contenido del reporte
     */
    renderReportContent() {
        if (this.isLoading) {
            return this.renderLoading();
        }
        if (this.error) {
            return this.renderError();
        }
        if (!this.reportData) {
            return this.renderEmptyState();
        }
        return `
            <!-- Resumen del reporte -->
            <div class="report-summary">
                <h3>Resumen del Reporte</h3>
                ${this.renderSummaryCards()}
            </div>

            <!-- Gráficos -->
            <div class="report-charts">
                <div class="chart-grid">
                    <div class="chart-item">
                        <h4>Distribución por Estado</h4>
                        ${this.renderStatusChart()}
                    </div>
                    <div class="chart-item">
                        <h4>Distribución por Prioridad</h4>
                        ${this.renderPriorityChart()}
                    </div>
                    <div class="chart-item">
                        <h4>Distribución por Tipo</h4>
                        ${this.renderTypeChart()}
                    </div>
                    <div class="chart-item">
                        <h4>Tendencia de Completación</h4>
                        ${this.renderTrendChart()}
                    </div>
                </div>
            </div>

            <!-- Productividad de usuarios -->
            <div class="user-productivity">
                <h3>Productividad por Usuario</h3>
                ${this.renderUserProductivity()}
            </div>

            <!-- Lista detallada de tareas -->
            <div class="task-details">
                <h3>Detalle de Tareas (${this.reportData.tasks.length} registros)</h3>
                ${this.renderTaskTable()}
            </div>

            <!-- Metadatos del reporte -->
            <div class="report-metadata">
                ${this.renderMetadata()}
            </div>
        `;
    }
    /**
     * Renderizar tarjetas de resumen
     */
    renderSummaryCards() {
        if (!this.reportData)
            return '';
        const { summary } = this.reportData;
        const completionRate = summary.totalTasks > 0 ?
            (summary.completedTasks / summary.totalTasks * 100).toFixed(1) : 0;
        return `
            <div class="summary-cards">
                <div class="summary-card">
                    <div class="card-icon">📋</div>
                    <div class="card-content">
                        <div class="card-value">${summary.totalTasks}</div>
                        <div class="card-label">Total de Tareas</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="card-icon">✅</div>
                    <div class="card-content">
                        <div class="card-value">${summary.completedTasks}</div>
                        <div class="card-label">Completadas</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="card-icon">⏳</div>
                    <div class="card-content">
                        <div class="card-value">${summary.pendingTasks}</div>
                        <div class="card-label">Pendientes</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="card-icon">⚠️</div>
                    <div class="card-content">
                        <div class="card-value">${summary.overdueTask}</div>
                        <div class="card-label">Vencidas</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <div class="card-value">${completionRate}%</div>
                        <div class="card-label">Tasa de Completación</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="card-icon">⏱️</div>
                    <div class="card-content">
                        <div class="card-value">${summary.averageCompletionTime.toFixed(1)}h</div>
                        <div class="card-label">Tiempo Promedio</div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * Renderizar gráfico de estado
     */
    renderStatusChart() {
        if (!this.reportData)
            return '';
        const { tasksByStatus } = this.reportData.charts;
        return `
            <div class="pie-chart-container">
                <div class="pie-chart">
                    ${tasksByStatus.map((item, index) => {
            const rotation = tasksByStatus.slice(0, index)
                .reduce((acc, curr) => acc + (curr.percentage * 3.6), 0);
            return `
                            <div class="pie-slice status-${item.label.toLowerCase().replace(' ', '_')}" 
                                 style="--rotation: ${rotation}deg; --percentage: ${item.percentage * 3.6}deg"
                                 title="${item.label}: ${item.value} (${item.percentage.toFixed(1)}%)">
                            </div>
                        `;
        }).join('')}
                </div>
                <div class="chart-legend">
                    ${tasksByStatus.map(item => `
                        <div class="legend-item">
                            <span class="legend-color status-${item.label.toLowerCase().replace(' ', '_')}"></span>
                            <span class="legend-text">${item.label} (${item.value})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    /**
     * Renderizar gráfico de prioridad
     */
    renderPriorityChart() {
        if (!this.reportData)
            return '';
        const { tasksByPriority } = this.reportData.charts;
        const maxValue = Math.max(...tasksByPriority.map(item => item.value));
        return `
            <div class="bar-chart">
                ${tasksByPriority.map(item => `
                    <div class="bar-item">
                        <div class="bar-label">${item.label}</div>
                        <div class="bar-container">
                            <div class="bar-fill priority-${item.label.toLowerCase()}" 
                                 style="height: ${(item.value / maxValue) * 100}%"
                                 title="${item.value} tareas">
                            </div>
                        </div>
                        <div class="bar-value">${item.value}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    /**
     * Renderizar gráfico de tipo
     */
    renderTypeChart() {
        if (!this.reportData)
            return '';
        const { tasksByType } = this.reportData.charts;
        return `
            <div class="type-distribution">
                ${tasksByType.map(item => `
                    <div class="type-item">
                        <div class="type-header">
                            <span class="type-name">${item.label}</span>
                            <span class="type-count">${item.value}</span>
                        </div>
                        <div class="type-bar">
                            <div class="type-fill" style="width: ${item.percentage}%"></div>
                        </div>
                        <div class="type-percentage">${item.percentage.toFixed(1)}%</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    /**
     * Renderizar gráfico de tendencia
     */
    renderTrendChart() {
        if (!this.reportData)
            return '';
        const { completionTrend } = this.reportData.charts;
        const maxValue = Math.max(...completionTrend.map(item => Math.max(item.completed, item.created)));
        return `
            <div class="trend-chart">
                <div class="trend-lines">
                    ${completionTrend.map((item, index) => `
                        <div class="trend-point" style="left: ${(index / (completionTrend.length - 1)) * 100}%">
                            <div class="point completed" 
                                 style="bottom: ${(item.completed / maxValue) * 100}%"
                                 title="Completadas: ${item.completed}">
                            </div>
                            <div class="point created" 
                                 style="bottom: ${(item.created / maxValue) * 100}%"
                                 title="Creadas: ${item.created}">
                            </div>
                            <div class="point-label">${new Date(item.date).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="trend-legend">
                    <div class="legend-item">
                        <span class="legend-color completed"></span>
                        <span>Completadas</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color created"></span>
                        <span>Creadas</span>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * Renderizar productividad de usuarios
     */
    renderUserProductivity() {
        if (!this.reportData)
            return '';
        const { userProductivity } = this.reportData.charts;
        if (userProductivity.length === 0) {
            return `
                <div class="no-productivity-data">
                    <p>No hay datos de productividad disponibles para el período seleccionado.</p>
                </div>
            `;
        }
        return `
            <div class="productivity-table">
                <table>
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Tareas Completadas</th>
                            <th>Tiempo Promedio</th>
                            <th>Puntuación</th>
                            <th>Rendimiento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userProductivity.map(user => `
                            <tr>
                                <td class="user-cell">
                                    <div class="user-avatar">${user.userName.charAt(0).toUpperCase()}</div>
                                    <span class="user-name">${this.escapeHtml(user.userName)}</span>
                                </td>
                                <td class="tasks-cell">${user.tasksCompleted}</td>
                                <td class="time-cell">${user.averageTime.toFixed(1)}h</td>
                                <td class="score-cell">${user.score.toFixed(1)}</td>
                                <td class="performance-cell">
                                    <div class="performance-bar">
                                        <div class="performance-fill" style="width: ${user.score}%"></div>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    /**
     * Renderizar tabla de tareas
     */
    renderTaskTable() {
        if (!this.reportData || this.reportData.tasks.length === 0) {
            return `
                <div class="no-tasks">
                    <p>No se encontraron tareas que coincidan con los filtros seleccionados.</p>
                </div>
            `;
        }
        return `
            <div class="task-table-container">
                <table class="task-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Título</th>
                            <th>Estado</th>
                            <th>Prioridad</th>
                            <th>Tipo</th>
                            <th>Asignado a</th>
                            <th>Fecha de Creación</th>
                            <th>Fecha de Vencimiento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.tasks.slice(0, 50).map(task => `
                            <tr>
                                <td class="id-cell">${task.id}</td>
                                <td class="title-cell">
                                    <div class="task-title" title="${this.escapeHtml(task.title)}">
                                        ${this.escapeHtml(task.title)}
                                    </div>
                                </td>
                                <td class="status-cell">
                                    <span class="status-badge status-${task.status}">
                                        ${this.getStatusLabel(task.status)}
                                    </span>
                                </td>
                                <td class="priority-cell">
                                    <span class="priority-badge priority-${task.priority}">
                                        ${this.getPriorityLabel(task.priority)}
                                    </span>
                                </td>
                                <td class="type-cell">${this.getTypeLabel(task.type)}</td>
                                <td class="assigned-cell">${task.assignedTo || 'Sin asignar'}</td>
                                <td class="date-cell">${new Date(task.createdAt).toLocaleDateString()}</td>
                                <td class="date-cell">
                                    ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Sin fecha'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${this.reportData.tasks.length > 50 ? `
                    <div class="table-footer">
                        <p>Mostrando las primeras 50 tareas de ${this.reportData.tasks.length} total. 
                           Exporta el reporte completo para ver todos los registros.</p>
                    </div>
                ` : ''}
            </div>
        `;
    }
    /**
     * Renderizar metadatos del reporte
     */
    renderMetadata() {
        if (!this.reportData)
            return '';
        const { metadata } = this.reportData;
        return `
            <div class="metadata-section">
                <h4>Información del Reporte</h4>
                <div class="metadata-grid">
                    <div class="metadata-item">
                        <span class="metadata-label">Generado el:</span>
                        <span class="metadata-value">${metadata.generatedAt.toLocaleString()}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Generado por:</span>
                        <span class="metadata-value">${metadata.generatedBy}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Período:</span>
                        <span class="metadata-value">
                            ${new Date(metadata.filters.dateRange.startDate).toLocaleDateString()} - 
                            ${new Date(metadata.filters.dateRange.endDate).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Total de registros:</span>
                        <span class="metadata-value">${metadata.totalRecords}</span>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * Renderizar estado de carga
     */
    renderLoading() {
        return `
            <div class="reporting-loading">
                <div class="loading-spinner"></div>
                <p>Generando reporte...</p>
            </div>
        `;
    }
    /**
     * Renderizar estado de error
     */
    renderError() {
        return `
            <div class="reporting-error">
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>Error al generar el reporte</h3>
                    <p>${this.error || 'Ocurrió un error inesperado al generar el reporte.'}</p>
                    <button class="retry-button" onclick="this.generateReport()">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Renderizar estado vacío
     */
    renderEmptyState() {
        return `
            <div class="reporting-empty">
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h3>Generar Reporte</h3>
                    <p>Configura los filtros y haz clic en "Generar Reporte" para crear un reporte personalizado.</p>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Botones de exportación
        document.getElementById('export-pdf')?.addEventListener('click', () => this.exportReport('pdf'));
        document.getElementById('export-excel')?.addEventListener('click', () => this.exportReport('excel'));
        document.getElementById('export-csv')?.addEventListener('click', () => this.exportReport('csv'));
        // Filtros
        document.getElementById('clear-filters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('apply-filters')?.addEventListener('click', () => this.generateReport());
        // Presets de fecha
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                if (preset) {
                    this.applyDatePreset(preset);
                }
            });
        });
        // Cambios en filtros
        document.getElementById('start-date')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('end-date')?.addEventListener('change', () => this.updateFilters());
        // Checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateFilters());
        });
        // Selects múltiples
        document.getElementById('assigned-to-select')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('created-by-select')?.addEventListener('change', () => this.updateFilters());
    }
    /**
     * Cargar usuarios
     */
    async loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.users = data.data?.users || [];
                this.populateUserSelects();
            }
        }
        catch (error) {
            console.error('Error loading users:', error);
        }
    }
    /**
     * Poblar selects de usuarios
     */
    populateUserSelects() {
        const assignedToSelect = document.getElementById('assigned-to-select');
        const createdBySelect = document.getElementById('created-by-select');
        if (assignedToSelect && createdBySelect) {
            const userOptions = this.users.map(user => `<option value="${user.id}">${this.escapeHtml(user.name)}</option>`).join('');
            assignedToSelect.innerHTML = '<option value="">Todos los usuarios</option>' + userOptions;
            createdBySelect.innerHTML = '<option value="">Todos los usuarios</option>' + userOptions;
        }
    }
    /**
     * Aplicar preset de fecha
     */
    applyDatePreset(preset) {
        const endDate = new Date();
        const startDate = new Date();
        switch (preset) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
            startDateInput.value = startDate.toISOString().split('T')[0];
            endDateInput.value = endDate.toISOString().split('T')[0];
            this.updateFilters();
        }
    }
    /**
     * Actualizar filtros
     */
    updateFilters() {
        // Fechas
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        this.filters.dateRange = {
            startDate: startDateInput.value,
            endDate: endDateInput.value
        };
        // Checkboxes
        this.filters.status = this.getCheckedValues('status-filters');
        this.filters.priority = this.getCheckedValues('priority-filters');
        this.filters.type = this.getCheckedValues('type-filters');
        // Selects múltiples
        const assignedToSelect = document.getElementById('assigned-to-select');
        const createdBySelect = document.getElementById('created-by-select');
        this.filters.assignedTo = Array.from(assignedToSelect.selectedOptions).map(option => option.value).filter(v => v);
        this.filters.createdBy = Array.from(createdBySelect.selectedOptions).map(option => option.value).filter(v => v);
    }
    /**
     * Obtener valores marcados de un grupo de checkboxes
     */
    getCheckedValues(groupId) {
        const group = document.getElementById(groupId);
        if (!group)
            return [];
        const checkboxes = group.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    /**
     * Limpiar filtros
     */
    clearFilters() {
        this.filters = this.getDefaultFilters();
        // Actualizar UI
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && endDateInput) {
            startDateInput.value = this.filters.dateRange.startDate;
            endDateInput.value = this.filters.dateRange.endDate;
        }
        // Limpiar checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        // Limpiar selects
        const assignedToSelect = document.getElementById('assigned-to-select');
        const createdBySelect = document.getElementById('created-by-select');
        if (assignedToSelect)
            assignedToSelect.selectedIndex = 0;
        if (createdBySelect)
            createdBySelect.selectedIndex = 0;
    }
    /**
     * Generar reporte
     */
    async generateReport() {
        this.updateFilters();
        this.setLoading(true);
        this.error = null;
        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.filters)
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            this.reportData = data;
            this.updateContent();
        }
        catch (error) {
            console.error('Error generating report:', error);
            this.error = error instanceof Error ? error.message : 'Error desconocido';
            this.updateContent();
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Exportar reporte
     */
    async exportReport(format) {
        if (!this.reportData) {
            alert('Primero debes generar un reporte antes de exportarlo.');
            return;
        }
        try {
            const response = await fetch(`/api/reports/export/${format}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.filters)
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            // Descargar archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
        catch (error) {
            console.error('Error exporting report:', error);
            alert('Error al exportar el reporte. Inténtalo de nuevo.');
        }
    }
    /**
     * Actualizar contenido
     */
    updateContent() {
        const content = document.getElementById('reporting-content');
        if (content) {
            content.innerHTML = this.renderReportContent();
        }
    }
    /**
     * Establecer estado de carga
     */
    setLoading(loading) {
        this.isLoading = loading;
        const applyButton = document.getElementById('apply-filters');
        if (applyButton) {
            applyButton.disabled = loading;
            applyButton.textContent = loading ? 'Generando...' : 'Generar Reporte';
        }
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
     * Obtener etiqueta de prioridad
     */
    getPriorityLabel(priority) {
        const labels = {
            'low': 'Baja',
            'medium': 'Media',
            'high': 'Alta',
            'critical': 'Crítica'
        };
        return labels[priority] || priority;
    }
    /**
     * Obtener etiqueta de tipo
     */
    getTypeLabel(type) {
        const labels = {
            'preventive': 'Preventivo',
            'corrective': 'Correctivo',
            'emergency': 'Emergencia',
            'inspection': 'Inspección'
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
     * Obtener datos del reporte actual
     */
    getCurrentReportData() {
        return this.reportData;
    }
    /**
     * Obtener filtros actuales
     */
    getCurrentFilters() {
        return { ...this.filters };
    }
}
