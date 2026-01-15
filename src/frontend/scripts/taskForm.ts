import { Task, TaskForm as TaskFormData, validateTaskForm } from './types.js';
import { authManager } from './main.js';

/**
 * Componente TaskForm para creación y edición de tareas
 */
export class TaskForm {
    private container: HTMLElement;
    private mode: 'create' | 'edit' = 'create';
    private task: Task | null = null;
    private isLoading: boolean = false;
    private onSave?: (task: Task) => void;
    private onCancel?: () => void;

    constructor(containerId: string, options?: {
        onSave?: (task: Task) => void;
        onCancel?: () => void;
    }) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.onSave = options?.onSave;
        this.onCancel = options?.onCancel;
        this.initialize();
    }

    /**
     * Inicializar el componente
     */
    private initialize(): void {
        this.render();
        this.setupEventListeners();
    }

    /**
     * Renderizar la estructura del componente
     */
    private render(): void {
        const title = this.mode === 'create' ? 'Crear Nueva Tarea' : 'Editar Tarea';
        const submitText = this.mode === 'create' ? 'Crear Tarea' : 'Guardar Cambios';

        this.container.innerHTML = `
            <div class="task-form-component">
                <div class="task-form-header">
                    <h2 class="form-title">${title}</h2>
                    <button class="close-button" id="close-form-button" title="Cerrar">
                        ✕
                    </button>
                </div>
                
                <form id="task-form" class="task-form">
                    <div class="form-content">
                        <!-- Información básica -->
                        <div class="form-section">
                            <h3 class="section-title">Información Básica</h3>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-title">Título *</label>
                                    <input 
                                        type="text" 
                                        id="task-title" 
                                        name="title" 
                                        required 
                                        maxlength="100"
                                        placeholder="Ingrese el título de la tarea"
                                    >
                                    <div class="field-error" id="title-error"></div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-type">Tipo *</label>
                                    <select id="task-type" name="type" required>
                                        <option value="">Seleccionar tipo</option>
                                        <option value="electrical">Eléctrico</option>
                                        <option value="mechanical">Mecánico</option>
                                    </select>
                                    <div class="field-error" id="type-error"></div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="task-description">Descripción *</label>
                                <textarea 
                                    id="task-description" 
                                    name="description" 
                                    rows="4" 
                                    required
                                    maxlength="500"
                                    placeholder="Describa detalladamente la tarea a realizar"
                                ></textarea>
                                <div class="field-error" id="description-error"></div>
                                <div class="field-hint">Máximo 500 caracteres</div>
                            </div>
                        </div>

                        <!-- Configuración de la tarea -->
                        <div class="form-section">
                            <h3 class="section-title">Configuración</h3>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-priority">Prioridad *</label>
                                    <select id="task-priority" name="priority" required>
                                        <option value="">Seleccionar prioridad</option>
                                        <option value="low">Baja</option>
                                        <option value="medium">Media</option>
                                        <option value="high">Alta</option>
                                        <option value="urgent">Urgente</option>
                                    </select>
                                    <div class="field-error" id="priority-error"></div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-location">Ubicación *</label>
                                    <input 
                                        type="text" 
                                        id="task-location" 
                                        name="location" 
                                        required
                                        maxlength="100"
                                        placeholder="Ej: Planta 1, Sector A"
                                    >
                                    <div class="field-error" id="location-error"></div>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-estimated-duration">Duración Estimada (minutos) *</label>
                                    <input 
                                        type="number" 
                                        id="task-estimated-duration" 
                                        name="estimatedDuration" 
                                        required
                                        min="1"
                                        max="9999"
                                        placeholder="60"
                                    >
                                    <div class="field-error" id="estimatedDuration-error"></div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-due-date">Fecha Límite *</label>
                                    <input 
                                        type="datetime-local" 
                                        id="task-due-date" 
                                        name="dueDate" 
                                        required
                                    >
                                    <div class="field-error" id="dueDate-error"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Asignación -->
                        <div class="form-section">
                            <h3 class="section-title">Asignación</h3>
                            
                            <div class="form-group">
                                <label for="task-assigned-to">Asignar a</label>
                                <select id="task-assigned-to" name="assignedTo">
                                    <option value="">Sin asignar</option>
                                    <!-- Las opciones se cargarán dinámicamente -->
                                </select>
                                <div class="field-error" id="assignedTo-error"></div>
                                <div class="field-hint">Opcional: Seleccione un usuario para asignar la tarea</div>
                            </div>
                        </div>

                        <!-- Herramientas requeridas -->
                        <div class="form-section">
                            <h3 class="section-title">Herramientas Requeridas</h3>
                            
                            <div class="form-group">
                                <label for="task-tools">Herramientas</label>
                                <div class="tools-input-container">
                                    <input 
                                        type="text" 
                                        id="task-tools-input" 
                                        placeholder="Escriba una herramienta y presione Enter"
                                        maxlength="50"
                                    >
                                    <button type="button" id="add-tool-button" class="add-tool-button">
                                        + Agregar
                                    </button>
                                </div>
                                <div class="tools-list" id="tools-list">
                                    <!-- Las herramientas se mostrarán aquí -->
                                </div>
                                <div class="field-hint">Opcional: Agregue las herramientas necesarias para completar la tarea</div>
                            </div>
                        </div>
                    </div>

                    <!-- Acciones del formulario -->
                    <div class="form-actions">
                        <button type="button" class="secondary-button" id="cancel-button">
                            Cancelar
                        </button>
                        <button type="submit" class="primary-button" id="submit-button">
                            <span class="button-text">${submitText}</span>
                            <div class="button-spinner" style="display: none;">
                                <div class="spinner"></div>
                            </div>
                        </button>
                    </div>
                    
                    <!-- Error general -->
                    <div class="form-error" id="form-error" style="display: none;"></div>
                </form>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    private setupEventListeners(): void {
        const form = document.getElementById('task-form') as HTMLFormElement;
        const closeButton = document.getElementById('close-form-button');
        const cancelButton = document.getElementById('cancel-button');
        const toolsInput = document.getElementById('task-tools-input') as HTMLInputElement;
        const addToolButton = document.getElementById('add-tool-button');

        // Envío del formulario
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Botones de cerrar y cancelar
        closeButton?.addEventListener('click', () => {
            this.handleCancel();
        });

        cancelButton?.addEventListener('click', () => {
            this.handleCancel();
        });

        // Herramientas
        toolsInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTool();
            }
        });

        addToolButton?.addEventListener('click', () => {
            this.addTool();
        });

        // Validación en tiempo real
        this.setupRealTimeValidation();

        // Cargar usuarios para asignación
        this.loadUsers();
    }

    /**
     * Configurar validación en tiempo real
     */
    private setupRealTimeValidation(): void {
        const fields = ['title', 'description', 'location', 'estimatedDuration'];
        
        fields.forEach(fieldName => {
            const field = document.getElementById(`task-${fieldName}`) as HTMLInputElement;
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(fieldName);
                });
                
                field.addEventListener('input', () => {
                    this.clearFieldError(fieldName);
                });
            }
        });

        // Validación especial para fecha
        const dueDateField = document.getElementById('task-due-date') as HTMLInputElement;
        dueDateField?.addEventListener('change', () => {
            this.validateField('dueDate');
        });
    }

    /**
     * Cargar usuarios para asignación
     */
    private async loadUsers(): Promise<void> {
        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${authManager.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const users = data.data?.users || [];
                this.populateUserSelect(users);
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            // No es crítico, el formulario puede funcionar sin usuarios
        }
    }

    /**
     * Poblar el select de usuarios
     */
    private populateUserSelect(users: any[]): void {
        const select = document.getElementById('task-assigned-to') as HTMLSelectElement;
        if (!select) return;

        // Limpiar opciones existentes (excepto la primera)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild!);
        }

        // Agregar usuarios
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.email})`;
            select.appendChild(option);
        });
    }

    /**
     * Agregar herramienta a la lista
     */
    private addTool(): void {
        const input = document.getElementById('task-tools-input') as HTMLInputElement;
        const toolName = input.value.trim();
        
        if (!toolName) return;
        
        // Verificar que no esté duplicada
        const existingTools = this.getCurrentTools();
        if (existingTools.includes(toolName)) {
            this.showFieldError('tools', 'Esta herramienta ya está en la lista');
            return;
        }
        
        // Agregar herramienta
        this.addToolToList(toolName);
        input.value = '';
        input.focus();
    }

    /**
     * Agregar herramienta a la lista visual
     */
    private addToolToList(toolName: string): void {
        const toolsList = document.getElementById('tools-list');
        if (!toolsList) return;

        const toolElement = document.createElement('div');
        toolElement.className = 'tool-item';
        toolElement.innerHTML = `
            <span class="tool-name">${this.escapeHtml(toolName)}</span>
            <button type="button" class="remove-tool-button" onclick="this.parentElement.remove()">
                ✕
            </button>
        `;
        
        toolsList.appendChild(toolElement);
    }

    /**
     * Obtener herramientas actuales
     */
    private getCurrentTools(): string[] {
        const toolsList = document.getElementById('tools-list');
        if (!toolsList) return [];

        const toolElements = toolsList.querySelectorAll('.tool-item .tool-name');
        return Array.from(toolElements).map(el => el.textContent || '');
    }

    /**
     * Manejar envío del formulario
     */
    private async handleSubmit(): Promise<void> {
        try {
            // Limpiar errores previos
            this.clearAllErrors();
            
            // Validar formulario
            const formData = this.getFormData();
            const validationErrors = this.validateForm(formData);
            
            if (validationErrors.length > 0) {
                this.showValidationErrors(validationErrors);
                return;
            }
            
            // Mostrar estado de carga
            this.setLoading(true);
            
            // Enviar datos
            const savedTask = await this.saveTask(formData);
            
            // Notificar éxito
            if (this.onSave) {
                this.onSave(savedTask);
            }
            
            console.log('✅ Tarea guardada exitosamente:', savedTask.title);
            
        } catch (error) {
            console.error('❌ Error guardando tarea:', error);
            
            let errorMessage = 'Error al guardar la tarea';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            this.showFormError(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Obtener datos del formulario
     */
    private getFormData(): TaskFormData {
        const form = document.getElementById('task-form') as HTMLFormElement;
        const formData = new FormData(form);
        
        return {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            type: formData.get('type') as 'electrical' | 'mechanical',
            priority: formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent',
            assignedTo: formData.get('assignedTo') as string || undefined,
            location: formData.get('location') as string,
            requiredTools: this.getCurrentTools(),
            estimatedDuration: parseInt(formData.get('estimatedDuration') as string),
            dueDate: formData.get('dueDate') as string
        };
    }

    /**
     * Validar formulario
     */
    private validateForm(formData: TaskFormData): string[] {
        const errors: string[] = [];
        
        // Usar validación de types.ts
        const typeErrors = validateTaskForm(formData);
        errors.push(...typeErrors);
        
        // Validaciones adicionales
        if (formData.dueDate) {
            const dueDate = new Date(formData.dueDate);
            const now = new Date();
            
            if (dueDate <= now) {
                errors.push('La fecha límite debe ser en el futuro');
            }
        }
        
        return errors;
    }

    /**
     * Validar campo individual
     */
    private validateField(fieldName: string): boolean {
        const field = document.getElementById(`task-${fieldName}`) as HTMLInputElement;
        if (!field) return true;
        
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        switch (fieldName) {
            case 'title':
                if (!value) {
                    errorMessage = 'El título es requerido';
                    isValid = false;
                } else if (value.length > 100) {
                    errorMessage = 'El título no puede exceder 100 caracteres';
                    isValid = false;
                }
                break;
                
            case 'description':
                if (!value) {
                    errorMessage = 'La descripción es requerida';
                    isValid = false;
                } else if (value.length > 500) {
                    errorMessage = 'La descripción no puede exceder 500 caracteres';
                    isValid = false;
                }
                break;
                
            case 'location':
                if (!value) {
                    errorMessage = 'La ubicación es requerida';
                    isValid = false;
                } else if (value.length > 100) {
                    errorMessage = 'La ubicación no puede exceder 100 caracteres';
                    isValid = false;
                }
                break;
                
            case 'estimatedDuration':
                const duration = parseInt(value);
                if (!value || isNaN(duration)) {
                    errorMessage = 'La duración estimada es requerida';
                    isValid = false;
                } else if (duration < 1) {
                    errorMessage = 'La duración debe ser mayor a 0';
                    isValid = false;
                } else if (duration > 9999) {
                    errorMessage = 'La duración no puede exceder 9999 minutos';
                    isValid = false;
                }
                break;
                
            case 'dueDate':
                if (!value) {
                    errorMessage = 'La fecha límite es requerida';
                    isValid = false;
                } else {
                    const dueDate = new Date(value);
                    const now = new Date();
                    if (dueDate <= now) {
                        errorMessage = 'La fecha límite debe ser en el futuro';
                        isValid = false;
                    }
                }
                break;
        }
        
        if (!isValid) {
            this.showFieldError(fieldName, errorMessage);
        } else {
            this.clearFieldError(fieldName);
        }
        
        return isValid;
    }

    /**
     * Guardar tarea
     */
    private async saveTask(formData: TaskFormData): Promise<Task> {
        const url = this.mode === 'create' ? '/api/tasks' : `/api/tasks/${this.task!.id}`;
        const method = this.mode === 'create' ? 'POST' : 'PUT';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
    }
    /**
     * Mostrar errores de validación
     */
    private showValidationErrors(errors: string[]): void {
        // Mostrar primer error como error general
        if (errors.length > 0) {
            this.showFormError(errors[0]);
        }
        
        // Intentar mostrar errores específicos por campo
        errors.forEach(error => {
            if (error.includes('título')) {
                this.showFieldError('title', error);
            } else if (error.includes('descripción')) {
                this.showFieldError('description', error);
            } else if (error.includes('ubicación')) {
                this.showFieldError('location', error);
            } else if (error.includes('duración')) {
                this.showFieldError('estimatedDuration', error);
            } else if (error.includes('fecha')) {
                this.showFieldError('dueDate', error);
            }
        });
    }

    /**
     * Mostrar error en campo específico
     */
    private showFieldError(fieldName: string, message: string): void {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const field = document.getElementById(`task-${fieldName}`) || document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        if (field) {
            field.classList.add('error');
        }
    }

    /**
     * Limpiar error de campo específico
     */
    private clearFieldError(fieldName: string): void {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const field = document.getElementById(`task-${fieldName}`) || document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
        
        if (field) {
            field.classList.remove('error');
        }
    }

    /**
     * Mostrar error general del formulario
     */
    private showFormError(message: string): void {
        const errorElement = document.getElementById('form-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Limpiar todos los errores
     */
    private clearAllErrors(): void {
        // Limpiar error general
        const formError = document.getElementById('form-error');
        if (formError) {
            formError.style.display = 'none';
            formError.textContent = '';
        }
        
        // Limpiar errores de campos
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(element => {
            element.textContent = '';
            (element as HTMLElement).style.display = 'none';
        });
        
        // Limpiar clases de error
        const fields = document.querySelectorAll('.error');
        fields.forEach(field => {
            field.classList.remove('error');
        });
    }

    /**
     * Establecer estado de carga
     */
    private setLoading(loading: boolean): void {
        this.isLoading = loading;
        
        const submitButton = document.getElementById('submit-button') as HTMLButtonElement;
        const buttonText = submitButton?.querySelector('.button-text') as HTMLElement;
        const buttonSpinner = submitButton?.querySelector('.button-spinner') as HTMLElement;
        const form = document.getElementById('task-form') as HTMLFormElement;
        
        if (loading) {
            submitButton.disabled = true;
            buttonText.style.display = 'none';
            buttonSpinner.style.display = 'flex';
            form.classList.add('loading');
        } else {
            submitButton.disabled = false;
            buttonText.style.display = 'block';
            buttonSpinner.style.display = 'none';
            form.classList.remove('loading');
        }
    }

    /**
     * Manejar cancelación
     */
    private handleCancel(): void {
        if (this.onCancel) {
            this.onCancel();
        } else {
            // Comportamiento por defecto
            this.reset();
        }
    }

    /**
     * Establecer modo de creación
     */
    public setCreateMode(): void {
        this.mode = 'create';
        this.task = null;
        this.render();
        this.setupEventListeners();
    }

    /**
     * Establecer modo de edición
     */
    public setEditMode(task: Task): void {
        this.mode = 'edit';
        this.task = task;
        this.render();
        this.setupEventListeners();
        this.populateForm(task);
    }

    /**
     * Poblar formulario con datos de tarea
     */
    private populateForm(task: Task): void {
        // Campos básicos
        this.setFieldValue('task-title', task.title);
        this.setFieldValue('task-description', task.description);
        this.setFieldValue('task-type', task.type);
        this.setFieldValue('task-priority', task.priority);
        this.setFieldValue('task-location', task.location);
        this.setFieldValue('task-estimated-duration', task.estimatedDuration.toString());
        this.setFieldValue('task-assigned-to', task.assignedTo || '');
        
        // Fecha límite
        const dueDate = new Date(task.dueDate);
        const dueDateString = dueDate.toISOString().slice(0, 16); // formato datetime-local
        this.setFieldValue('task-due-date', dueDateString);
        
        // Herramientas
        if (task.requiredTools && task.requiredTools.length > 0) {
            task.requiredTools.forEach(tool => {
                this.addToolToList(tool);
            });
        }
    }

    /**
     * Establecer valor de campo
     */
    private setFieldValue(fieldId: string, value: string): void {
        const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (field) {
            field.value = value;
        }
    }

    /**
     * Resetear formulario
     */
    public reset(): void {
        const form = document.getElementById('task-form') as HTMLFormElement;
        if (form) {
            form.reset();
        }
        
        // Limpiar herramientas
        const toolsList = document.getElementById('tools-list');
        if (toolsList) {
            toolsList.innerHTML = '';
        }
        
        // Limpiar errores
        this.clearAllErrors();
        
        // Resetear estado
        this.task = null;
        this.mode = 'create';
        this.isLoading = false;
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
     * Obtener tarea actual (en modo edición)
     */
    public getCurrentTask(): Task | null {
        return this.task;
    }

    /**
     * Obtener modo actual
     */
    public getMode(): 'create' | 'edit' {
        return this.mode;
    }

    /**
     * Verificar si el formulario está en estado de carga
     */
    public isFormLoading(): boolean {
        return this.isLoading;
    }
}