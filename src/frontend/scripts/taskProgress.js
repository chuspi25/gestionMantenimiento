import { authManager } from './main.js';
/**
 * Componente TaskProgress para actualización de estado de tareas
 * Permite cambiar estado, agregar notas y subir archivos
 */
export class TaskProgress {
    container;
    task = null;
    isLoading = false;
    error = null;
    onTaskUpdated;
    onClose;
    constructor(containerId, options) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.onTaskUpdated = options?.onTaskUpdated;
        this.onClose = options?.onClose;
    }
    /**
     * Mostrar el componente para una tarea específica
     */
    show(task) {
        this.task = task;
        this.error = null;
        this.render();
        this.setupEventListeners();
        this.container.style.display = 'block';
    }
    /**
     * Ocultar el componente
     */
    hide() {
        this.container.style.display = 'none';
        this.task = null;
        if (this.onClose) {
            this.onClose();
        }
    }
    /**
     * Renderizar el componente
     */
    render() {
        if (!this.task)
            return;
        const task = this.task;
        const statusOptions = this.getStatusOptions(task.status);
        const priorityClass = this.getPriorityClass(task.priority);
        const statusClass = this.getStatusClass(task.status);
        this.container.innerHTML = `
            <div class="task-progress-modal">
                <div class="task-progress-content">
                    <!-- Header -->
                    <div class="task-progress-header">
                        <div class="task-progress-title">
                            <h2>Actualizar Progreso</h2>
                            <button class="close-button" id="close-progress">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        
                        <!-- Task Info -->
                        <div class="task-info-summary">
                            <div class="task-title-row">
                                <h3>${task.title}</h3>
                                <div class="task-badges">
                                    <span class="priority-badge ${priorityClass}">${this.formatPriority(task.priority)}</span>
                                    <span class="status-badge ${statusClass}">${this.formatStatus(task.status)}</span>
                                </div>
                            </div>
                            <p class="task-location">📍 ${task.location}</p>
                        </div>
                    </div>

                    <!-- Error Display -->
                    ${this.error ? `
                        <div class="error-message">
                            <span class="error-icon">⚠️</span>
                            ${this.error}
                        </div>
                    ` : ''}

                    <!-- Loading Overlay -->
                    ${this.isLoading ? `
                        <div class="loading-overlay">
                            <div class="loading-spinner"></div>
                            <p>Actualizando...</p>
                        </div>
                    ` : ''}

                    <!-- Progress Sections -->
                    <div class="progress-sections">
                        <!-- Status Update Section -->
                        <section class="progress-section">
                            <h4>🔄 Cambiar Estado</h4>
                            <div class="status-update-form">
                                <div class="form-group">
                                    <label for="new-status">Nuevo Estado</label>
                                    <select id="new-status" class="form-select">
                                        ${statusOptions.map(option => `
                                            <option value="${option.value}" ${option.value === task.status ? 'selected' : ''}>
                                                ${option.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="status-note">Nota del cambio (opcional)</label>
                                    <textarea 
                                        id="status-note" 
                                        class="form-textarea" 
                                        placeholder="Describe el motivo del cambio de estado..."
                                        rows="3"
                                    ></textarea>
                                </div>
                                
                                <button class="btn btn-primary" id="update-status-btn">
                                    Actualizar Estado
                                </button>
                            </div>
                        </section>

                        <!-- Add Note Section -->
                        <section class="progress-section">
                            <h4>📝 Agregar Nota</h4>
                            <div class="add-note-form">
                                <div class="form-group">
                                    <label for="note-content">Contenido de la nota</label>
                                    <textarea 
                                        id="note-content" 
                                        class="form-textarea" 
                                        placeholder="Escribe tu nota aquí..."
                                        rows="4"
                                        required
                                    ></textarea>
                                </div>
                                
                                <button class="btn btn-secondary" id="add-note-btn">
                                    Agregar Nota
                                </button>
                            </div>
                        </section>

                        <!-- File Upload Section -->
                        <section class="progress-section">
                            <h4>📎 Subir Archivo</h4>
                            <div class="file-upload-form">
                                <div class="form-group">
                                    <label for="file-input">Seleccionar archivo</label>
                                    <input 
                                        type="file" 
                                        id="file-input" 
                                        class="form-file-input"
                                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
                                    >
                                    <div class="file-input-help">
                                        Formatos permitidos: JPG, PNG, PDF, DOC, DOCX, TXT (máx. 10MB)
                                    </div>
                                </div>
                                
                                <div class="form-group" style="display: none;" id="file-description-group">
                                    <label for="file-description">Descripción del archivo (opcional)</label>
                                    <input 
                                        type="text" 
                                        id="file-description" 
                                        class="form-input" 
                                        placeholder="Describe el contenido del archivo..."
                                    >
                                </div>
                                
                                <button class="btn btn-secondary" id="upload-file-btn" disabled>
                                    Subir Archivo
                                </button>
                            </div>
                        </section>

                        <!-- Recent Activity -->
                        <section class="progress-section">
                            <h4>📋 Actividad Reciente</h4>
                            <div class="recent-activity">
                                ${this.renderRecentActivity()}
                            </div>
                        </section>
                    </div>

                    <!-- Action Buttons -->
                    <div class="progress-actions">
                        <button class="btn btn-outline" id="cancel-progress">
                            Cancelar
                        </button>
                        <button class="btn btn-primary" id="save-and-close">
                            Guardar y Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Close buttons
        const closeButton = document.getElementById('close-progress');
        const cancelButton = document.getElementById('cancel-progress');
        closeButton?.addEventListener('click', () => this.hide());
        cancelButton?.addEventListener('click', () => this.hide());
        // Status update
        const updateStatusBtn = document.getElementById('update-status-btn');
        updateStatusBtn?.addEventListener('click', () => this.handleStatusUpdate());
        // Add note
        const addNoteBtn = document.getElementById('add-note-btn');
        addNoteBtn?.addEventListener('click', () => this.handleAddNote());
        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-file-btn');
        const fileDescriptionGroup = document.getElementById('file-description-group');
        fileInput?.addEventListener('change', () => {
            const hasFile = fileInput.files && fileInput.files.length > 0;
            const uploadButton = uploadBtn;
            if (uploadButton)
                uploadButton.disabled = !hasFile;
            if (fileDescriptionGroup) {
                fileDescriptionGroup.style.display = hasFile ? 'block' : 'none';
            }
        });
        uploadBtn?.addEventListener('click', () => this.handleFileUpload());
        // Save and close
        const saveAndCloseBtn = document.getElementById('save-and-close');
        saveAndCloseBtn?.addEventListener('click', () => this.hide());
        // Click outside to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
            }
        });
    }
    /**
     * Manejar actualización de estado
     */
    async handleStatusUpdate() {
        if (!this.task)
            return;
        const newStatusSelect = document.getElementById('new-status');
        const statusNoteTextarea = document.getElementById('status-note');
        const newStatus = newStatusSelect.value;
        const statusNote = statusNoteTextarea.value.trim();
        if (newStatus === this.task.status && !statusNote) {
            this.showError('No hay cambios para actualizar');
            return;
        }
        this.setLoading(true);
        this.clearError();
        try {
            // Actualizar estado de la tarea
            const response = await fetch(`/api/tasks/${this.task.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: JSON.stringify({
                    status: newStatus
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al actualizar el estado de la tarea');
            }
            const responseData = await response.json();
            const updatedTask = responseData.data;
            this.task = updatedTask;
            // Si hay una nota, agregarla por separado
            if (statusNote) {
                await this.addNoteToTask(statusNote);
            }
            // Limpiar formulario
            statusNoteTextarea.value = '';
            // Notificar actualización
            if (this.onTaskUpdated) {
                this.onTaskUpdated(updatedTask);
            }
            // Re-renderizar para mostrar cambios
            this.render();
            this.setupEventListeners();
            this.showSuccess('Estado actualizado correctamente');
        }
        catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Error al actualizar el estado de la tarea');
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Manejar adición de nota
     */
    async handleAddNote() {
        if (!this.task)
            return;
        const noteContentTextarea = document.getElementById('note-content');
        const content = noteContentTextarea.value.trim();
        if (!content) {
            this.showError('El contenido de la nota es requerido');
            return;
        }
        this.setLoading(true);
        this.clearError();
        try {
            const response = await fetch(`/api/tasks/${this.task.id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: JSON.stringify({ content })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al agregar la nota');
            }
            const responseData = await response.json();
            const newNote = responseData.data;
            // Actualizar tarea local
            if (!this.task.notes) {
                this.task.notes = [];
            }
            this.task.notes.push(newNote);
            // Limpiar formulario
            noteContentTextarea.value = '';
            // Notificar actualización
            if (this.onTaskUpdated) {
                this.onTaskUpdated(this.task);
            }
            // Re-renderizar para mostrar la nueva nota
            this.render();
            this.setupEventListeners();
            this.showSuccess('Nota agregada correctamente');
        }
        catch (error) {
            console.error('Error adding note:', error);
            this.showError('Error al agregar la nota');
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Manejar subida de archivo
     */
    async handleFileUpload() {
        if (!this.task)
            return;
        const fileInput = document.getElementById('file-input');
        const fileDescriptionInput = document.getElementById('file-description');
        if (!fileInput.files || fileInput.files.length === 0) {
            this.showError('Selecciona un archivo para subir');
            return;
        }
        const file = fileInput.files[0];
        // Validar tamaño del archivo (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('El archivo es demasiado grande. Máximo 10MB permitido');
            return;
        }
        this.setLoading(true);
        this.clearError();
        try {
            // Simular subida de archivo (en una implementación real, subirías a un servicio de almacenamiento)
            const fileUrl = `https://example.com/files/${Date.now()}_${file.name}`;
            const response = await fetch(`/api/tasks/${this.task.id}/attachments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authManager.getToken()}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileUrl: fileUrl,
                    fileType: file.type || 'application/octet-stream'
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al subir el archivo');
            }
            const responseData = await response.json();
            const newAttachment = responseData.data;
            // Actualizar tarea local
            if (!this.task.attachments) {
                this.task.attachments = [];
            }
            this.task.attachments.push(newAttachment);
            // Limpiar formulario
            fileInput.value = '';
            fileDescriptionInput.value = '';
            const uploadButton = document.getElementById('upload-file-btn');
            if (uploadButton)
                uploadButton.disabled = true;
            const fileDescriptionGroup = document.getElementById('file-description-group');
            if (fileDescriptionGroup)
                fileDescriptionGroup.style.display = 'none';
            // Notificar actualización
            if (this.onTaskUpdated) {
                this.onTaskUpdated(this.task);
            }
            // Re-renderizar para mostrar el nuevo archivo
            this.render();
            this.setupEventListeners();
            this.showSuccess('Archivo subido correctamente');
        }
        catch (error) {
            console.error('Error uploading file:', error);
            this.showError('Error al subir el archivo');
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Agregar nota a la tarea (método auxiliar)
     */
    async addNoteToTask(content) {
        const response = await fetch(`/api/tasks/${this.task.id}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authManager.getToken()}`
            },
            body: JSON.stringify({ content })
        });
        if (response.ok) {
            const responseData = await response.json();
            const newNote = responseData.data;
            if (!this.task.notes) {
                this.task.notes = [];
            }
            this.task.notes.push(newNote);
        }
    }
    /**
     * Renderizar actividad reciente
     */
    renderRecentActivity() {
        if (!this.task)
            return '<p class="no-activity">No hay actividad reciente</p>';
        const recentNotes = this.task.notes
            .slice(-3)
            .reverse()
            .map(note => `
                <div class="activity-item">
                    <div class="activity-icon">📝</div>
                    <div class="activity-content">
                        <p class="activity-text">${note.content}</p>
                        <p class="activity-meta">
                            ${new Date(note.createdAt).toLocaleString('es-ES')}
                        </p>
                    </div>
                </div>
            `).join('');
        const recentAttachments = this.task.attachments
            .slice(-2)
            .reverse()
            .map(attachment => `
                <div class="activity-item">
                    <div class="activity-icon">📎</div>
                    <div class="activity-content">
                        <p class="activity-text">Archivo subido: ${attachment.fileName}</p>
                        <p class="activity-meta">
                            ${new Date(attachment.uploadedAt).toLocaleString('es-ES')}
                        </p>
                    </div>
                </div>
            `).join('');
        const activity = recentNotes + recentAttachments;
        return activity || '<p class="no-activity">No hay actividad reciente</p>';
    }
    /**
     * Obtener opciones de estado disponibles
     */
    getStatusOptions(currentStatus) {
        const allOptions = [
            { value: 'pending', label: 'Pendiente' },
            { value: 'in_progress', label: 'En Progreso' },
            { value: 'completed', label: 'Completada' },
            { value: 'cancelled', label: 'Cancelada' }
        ];
        // Lógica de transiciones de estado permitidas
        switch (currentStatus) {
            case 'pending':
                return allOptions.filter(opt => ['pending', 'in_progress', 'cancelled'].includes(opt.value));
            case 'in_progress':
                return allOptions.filter(opt => ['in_progress', 'completed', 'cancelled'].includes(opt.value));
            case 'completed':
                return allOptions.filter(opt => ['completed', 'in_progress'].includes(opt.value));
            case 'cancelled':
                return allOptions.filter(opt => ['cancelled', 'pending'].includes(opt.value));
            default:
                return allOptions;
        }
    }
    /**
     * Obtener clase CSS para prioridad
     */
    getPriorityClass(priority) {
        const classes = {
            'low': 'priority-low',
            'medium': 'priority-medium',
            'high': 'priority-high',
            'urgent': 'priority-urgent'
        };
        return classes[priority] || '';
    }
    /**
     * Obtener clase CSS para estado
     */
    getStatusClass(status) {
        const classes = {
            'pending': 'status-pending',
            'in_progress': 'status-in-progress',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled'
        };
        return classes[status] || '';
    }
    /**
     * Formatear prioridad para mostrar
     */
    formatPriority(priority) {
        const labels = {
            'low': 'Baja',
            'medium': 'Media',
            'high': 'Alta',
            'urgent': 'Urgente'
        };
        return labels[priority] || priority;
    }
    /**
     * Formatear estado para mostrar
     */
    formatStatus(status) {
        const labels = {
            'pending': 'Pendiente',
            'in_progress': 'En Progreso',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };
        return labels[status] || status;
    }
    /**
     * Mostrar estado de carga
     */
    setLoading(loading) {
        this.isLoading = loading;
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
    }
    /**
     * Mostrar error
     */
    showError(message) {
        this.error = message;
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.innerHTML = `
                <span class="error-icon">⚠️</span>
                ${message}
            `;
            errorElement.style.display = 'block';
        }
        // Auto-hide error after 5 seconds
        setTimeout(() => this.clearError(), 5000);
    }
    /**
     * Limpiar error
     */
    clearError() {
        this.error = null;
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    /**
     * Mostrar mensaje de éxito
     */
    showSuccess(message) {
        // Crear elemento de éxito temporal
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.innerHTML = `
            <span class="success-icon">✅</span>
            ${message}
        `;
        const header = document.querySelector('.task-progress-header');
        if (header) {
            header.appendChild(successElement);
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (successElement.parentNode) {
                    successElement.parentNode.removeChild(successElement);
                }
            }, 3000);
        }
    }
}
