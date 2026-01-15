import { authManager } from './main.js';
/**
 * Componente TaskDetail para mostrar detalles completos de una tarea
 */
export class TaskDetail {
    container;
    task = null;
    isLoading = false;
    error = null;
    onClose;
    onEdit;
    onStatusChange;
    constructor(containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.onClose = options?.onClose;
        this.onEdit = options?.onEdit;
        this.onStatusChange = options?.onStatusChange;
        this.initialize();
    }
    /**
     * Inicializar el componente
     */
    initialize() {
        this.render();
        this.setupEventListeners();
    }
    /**
     * Renderizar la estructura del componente
     */
    render() {
        this.container.innerHTML = `
            <div class="task-detail-component">
                <div class="task-detail-header">
                    <button class="back-button" id="back-button" title="Volver">
                        ← Volver
                    </button>
                    <div class="task-detail-actions">
                        <button class="action-button edit-button" id="edit-task-button" data-permission="canEditTasks">
                            ✏️ Editar
                        </button>
                        <button class="action-button status-button" id="change-status-button" data-permission="canUpdateTaskStatus">
                            🔄 Cambiar Estado
                        </button>
                    </div>
                </div>
                
                <div id="task-detail-content" class="task-detail-content">
                    <!-- El contenido se renderizará aquí -->
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        const backButton = document.getElementById('back-button');
        const editButton = document.getElementById('edit-task-button');
        const statusButton = document.getElementById('change-status-button');
        backButton?.addEventListener('click', () => {
            this.handleBack();
        });
        editButton?.addEventListener('click', () => {
            if (this.task && this.onEdit) {
                this.onEdit(this.task);
            }
        });
        statusButton?.addEventListener('click', () => {
            if (this.task && this.onStatusChange) {
                this.onStatusChange(this.task);
            }
        });
    }
    /**
     * Cargar y mostrar una tarea
     */
    async loadTask(taskId) {
        this.setLoading(true);
        this.error = null;
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            this.task = data.task;
            this.renderTaskDetail();
        }
        catch (error) {
            console.error('Error cargando tarea:', error);
            this.error = error instanceof Error ? error.message : 'Error desconocido';
            this.renderError();
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Mostrar una tarea específica (sin cargar desde API)
     */
    showTask(task) {
        this.task = task;
        this.renderTaskDetail();
    }
    /**
     * Renderizar los detalles de la tarea
     */
    renderTaskDetail() {
        const content = document.getElementById('task-detail-content');
        if (!content || !this.task)
            return;
        if (this.isLoading) {
            this.renderLoading();
            return;
        }
        if (this.error) {
            this.renderError();
            return;
        }
        const task = this.task;
        const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';
        const dueDate = new Date(task.dueDate);
        const createdDate = new Date(task.createdAt);
        const startedDate = task.startedAt ? new Date(task.startedAt) : null;
        const completedDate = task.completedAt ? new Date(task.completedAt) : null;
        content.innerHTML = `
            <div class="task-detail-main">
                <!-- Información principal -->
                <div class="task-header-section">
                    <div class="task-title-section">
                        <h1 class="task-detail-title">${this.escapeHtml(task.title)}</h1>
                        <div class="task-badges">
                            <span class="priority-badge priority-${task.priority}">
                                ${this.getPriorityLabel(task.priority)}
                            </span>
                            <span class="status-badge status-${task.status}">
                                ${this.getStatusLabel(task.status)}
                            </span>
                            <span class="type-badge type-${task.type}">
                                ${this.getTypeLabel(task.type)}
                            </span>
                            ${isOverdue ? '<span class="overdue-badge">Vencida</span>' : ''}
                        </div>
                    </div>
                </div>

                <!-- Descripción -->
                <div class="task-section">
                    <h3 class="section-title">Descripción</h3>
                    <div class="task-description">
                        ${this.escapeHtml(task.description).replace(/\n/g, '<br>')}
                    </div>
                </div>

                <!-- Información general -->
                <div class="task-section">
                    <h3 class="section-title">Información General</h3>
                    <div class="task-info-grid">
                        <div class="info-item">
                            <span class="info-label">Ubicación</span>
                            <span class="info-value">${this.escapeHtml(task.location)}</span>
                        </div>
                        
                        <div class="info-item">
                            <span class="info-label">Duración Estimada</span>
                            <span class="info-value">${task.estimatedDuration} minutos</span>
                        </div>
                        
                        <div class="info-item">
                            <span class="info-label">Fecha Límite</span>
                            <span class="info-value ${isOverdue ? 'overdue' : ''}">
                                ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}
                            </span>
                        </div>
                        
                        <div class="info-item">
                            <span class="info-label">Fecha de Creación</span>
                            <span class="info-value">
                                ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}
                            </span>
                        </div>
                        
                        ${startedDate ? `
                            <div class="info-item">
                                <span class="info-label">Fecha de Inicio</span>
                                <span class="info-value">
                                    ${startedDate.toLocaleDateString()} ${startedDate.toLocaleTimeString()}
                                </span>
                            </div>
                        ` : ''}
                        
                        ${completedDate ? `
                            <div class="info-item">
                                <span class="info-label">Fecha de Finalización</span>
                                <span class="info-value">
                                    ${completedDate.toLocaleDateString()} ${completedDate.toLocaleTimeString()}
                                </span>
                            </div>
                        ` : ''}
                        
                        <div class="info-item">
                            <span class="info-label">Asignada a</span>
                            <span class="info-value">
                                ${task.assignedTo ? 'Usuario asignado' : 'Sin asignar'}
                            </span>
                        </div>
                        
                        <div class="info-item">
                            <span class="info-label">Creada por</span>
                            <span class="info-value">Usuario creador</span>
                        </div>
                    </div>
                </div>

                <!-- Herramientas requeridas -->
                ${task.requiredTools && task.requiredTools.length > 0 ? `
                    <div class="task-section">
                        <h3 class="section-title">Herramientas Requeridas</h3>
                        <div class="tools-grid">
                            ${task.requiredTools.map(tool => `
                                <div class="tool-item">
                                    <span class="tool-icon">🔧</span>
                                    <span class="tool-name">${this.escapeHtml(tool)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Progreso de la tarea -->
                <div class="task-section">
                    <h3 class="section-title">Progreso</h3>
                    <div class="progress-section">
                        <div class="progress-bar">
                            <div class="progress-fill progress-${task.status}" style="width: ${this.getProgressPercentage(task.status)}%"></div>
                        </div>
                        <div class="progress-labels">
                            <span class="progress-label ${task.status === 'pending' ? 'active' : this.isStatusAfter('pending', task.status) ? 'completed' : ''}">
                                Pendiente
                            </span>
                            <span class="progress-label ${task.status === 'in_progress' ? 'active' : this.isStatusAfter('in_progress', task.status) ? 'completed' : ''}">>
                                En Progreso
                            </span>
                            <span class="progress-label ${task.status === 'completed' ? 'active' : ''}">
                                Completada
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Notas -->
                <div class="task-section">
                    <div class="section-header">
                        <h3 class="section-title">Notas y Comentarios</h3>
                        <button class="add-note-button" id="add-note-button" data-permission="canAddTaskNotes">
                            + Agregar Nota
                        </button>
                    </div>
                    <div class="notes-container" id="notes-container">
                        ${this.renderNotes(task.notes || [])}
                    </div>
                </div>

                <!-- Archivos adjuntos -->
                <div class="task-section">
                    <div class="section-header">
                        <h3 class="section-title">Archivos Adjuntos</h3>
                        <button class="add-attachment-button" id="add-attachment-button" data-permission="canAddTaskAttachments">
                            📎 Subir Archivo
                        </button>
                    </div>
                    <div class="attachments-container" id="attachments-container">
                        ${this.renderAttachments(task.attachments || [])}
                    </div>
                </div>
            </div>
        `;
        this.setupTaskDetailEventListeners();
    }
    /**
     * Configurar event listeners específicos del detalle de tarea
     */
    setupTaskDetailEventListeners() {
        const addNoteButton = document.getElementById('add-note-button');
        const addAttachmentButton = document.getElementById('add-attachment-button');
        addNoteButton?.addEventListener('click', () => {
            this.showAddNoteModal();
        });
        addAttachmentButton?.addEventListener('click', () => {
            this.showAddAttachmentModal();
        });
    }
    /**
     * Renderizar notas
     */
    renderNotes(notes) {
        if (notes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <p>No hay notas para esta tarea</p>
                </div>
            `;
        }
        return notes.map(note => {
            const noteDate = new Date(note.createdAt);
            return `
                <div class="note-item">
                    <div class="note-header">
                        <span class="note-author">Usuario</span>
                        <span class="note-date">${noteDate.toLocaleDateString()} ${noteDate.toLocaleTimeString()}</span>
                    </div>
                    <div class="note-content">
                        ${this.escapeHtml(note.content).replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }).join('');
    }
    /**
     * Renderizar archivos adjuntos
     */
    renderAttachments(attachments) {
        if (attachments.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📎</div>
                    <p>No hay archivos adjuntos para esta tarea</p>
                </div>
            `;
        }
        return attachments.map(attachment => {
            const uploadDate = new Date(attachment.uploadedAt);
            const fileIcon = this.getFileIcon(attachment.fileType);
            return `
                <div class="attachment-item">
                    <div class="attachment-icon">${fileIcon}</div>
                    <div class="attachment-info">
                        <div class="attachment-name">${this.escapeHtml(attachment.fileName)}</div>
                        <div class="attachment-meta">
                            <span class="attachment-size">${this.formatFileSize(attachment.fileType)}</span>
                            <span class="attachment-date">${uploadDate.toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="attachment-actions">
                        <button class="attachment-action download-button" onclick="window.open('${attachment.fileUrl}', '_blank')">
                            ⬇️ Descargar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    /**
     * Mostrar modal para agregar nota
     */
    showAddNoteModal() {
        // Implementar modal para agregar nota
        const noteContent = prompt('Ingrese el contenido de la nota:');
        if (noteContent && noteContent.trim()) {
            this.addNote(noteContent.trim());
        }
    }
    /**
     * Mostrar modal para agregar archivo adjunto
     */
    showAddAttachmentModal() {
        // Crear input de archivo temporal
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt';
        fileInput.addEventListener('change', (e) => {
            const target = e.target;
            if (target.files && target.files.length > 0) {
                Array.from(target.files).forEach(file => {
                    this.addAttachment(file);
                });
            }
        });
        fileInput.click();
    }
    /**
     * Agregar nota a la tarea
     */
    async addNote(content) {
        if (!this.task)
            return;
        try {
            const response = await fetch(`/api/tasks/${this.task.id}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            // Recargar la tarea para mostrar la nueva nota
            await this.loadTask(this.task.id);
        }
        catch (error) {
            console.error('Error agregando nota:', error);
            alert('Error al agregar la nota. Por favor, intente nuevamente.');
        }
    }
    /**
     * Agregar archivo adjunto a la tarea
     */
    async addAttachment(file) {
        if (!this.task)
            return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`/api/tasks/${this.task.id}/attachments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: formData
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            // Recargar la tarea para mostrar el nuevo archivo
            await this.loadTask(this.task.id);
        }
        catch (error) {
            console.error('Error subiendo archivo:', error);
            alert('Error al subir el archivo. Por favor, intente nuevamente.');
        }
    }
    /**
     * Renderizar estado de carga
     */
    renderLoading() {
        const content = document.getElementById('task-detail-content');
        if (!content)
            return;
        content.innerHTML = `
            <div class="task-detail-loading">
                <div class="loading-spinner"></div>
                <p>Cargando detalles de la tarea...</p>
            </div>
        `;
    }
    /**
     * Renderizar estado de error
     */
    renderError() {
        const content = document.getElementById('task-detail-content');
        if (!content)
            return;
        content.innerHTML = `
            <div class="task-detail-error">
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>Error al cargar la tarea</h3>
                    <p>${this.error || 'Ocurrió un error inesperado al cargar los detalles de la tarea.'}</p>
                    <button class="retry-button" onclick="this.loadTask('${this.task?.id || ''}')">
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
     * Manejar botón de volver
     */
    handleBack() {
        if (this.onClose) {
            this.onClose();
        }
        else {
            // Navegación por defecto
            window.history.back();
        }
    }
    /**
     * Obtener porcentaje de progreso basado en el estado
     */
    getProgressPercentage(status) {
        const percentages = {
            'pending': 25,
            'in_progress': 75,
            'completed': 100,
            'cancelled': 0
        };
        return percentages[status] || 0;
    }
    /**
     * Verificar si un estado viene después de otro
     */
    isStatusAfter(status1, status2) {
        const statusOrder = ['pending', 'in_progress', 'completed'];
        const index1 = statusOrder.indexOf(status1);
        const index2 = statusOrder.indexOf(status2);
        return index2 > index1;
    }
    /**
     * Obtener icono de archivo basado en el tipo
     */
    getFileIcon(fileType) {
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'txt': '📄',
            'default': '📎'
        };
        const extension = fileType.toLowerCase().split('/').pop() || 'default';
        return icons[extension] || icons.default;
    }
    /**
     * Formatear tamaño de archivo (placeholder)
     */
    formatFileSize(_fileType) {
        // En una implementación real, esto vendría del servidor
        return 'Tamaño desconocido';
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
     * Obtener tarea actual
     */
    getCurrentTask() {
        return this.task;
    }
    /**
     * Refrescar los detalles de la tarea
     */
    refresh() {
        if (this.task) {
            this.loadTask(this.task.id);
        }
    }
}
