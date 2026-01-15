import { User } from './types.js';
import { authManager } from './main.js';

/**
 * Datos del formulario de usuario
 */
interface UserFormData {
    name: string;
    email: string;
    role: 'operator' | 'supervisor' | 'admin';
    password?: string;
    confirmPassword?: string;
    isActive: boolean;
}

/**
 * Componente UserForm para creación y edición de usuarios
 */
export class UserForm {
    private container: HTMLElement;
    private mode: 'create' | 'edit' = 'create';
    private user: User | null = null;
    private isLoading: boolean = false;
    private onSave?: (user: User) => void;
    private onCancel?: () => void;

    constructor(containerId: string, options?: {
        onSave?: (user: User) => void;
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
        const title = this.mode === 'create' ? 'Crear Nuevo Usuario' : 'Editar Usuario';
        const submitText = this.mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios';
        const showPasswordFields = this.mode === 'create';

        this.container.innerHTML = `
            <div class="user-form-component">
                <div class="user-form-header">
                    <h2 class="form-title">${title}</h2>
                    <button class="close-button" id="close-form-button" title="Cerrar">
                        ✕
                    </button>
                </div>
                
                <form id="user-form" class="user-form">
                    <div class="form-content">
                        <!-- Información personal -->
                        <div class="form-section">
                            <h3 class="section-title">Información Personal</h3>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="user-name">Nombre completo *</label>
                                    <input 
                                        type="text" 
                                        id="user-name" 
                                        name="name" 
                                        required 
                                        maxlength="100"
                                        placeholder="Ingrese el nombre completo"
                                    >
                                    <div class="field-error" id="name-error"></div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="user-email">Correo electrónico *</label>
                                    <input 
                                        type="email" 
                                        id="user-email" 
                                        name="email" 
                                        required 
                                        maxlength="255"
                                        placeholder="usuario@empresa.com"
                                    >
                                    <div class="field-error" id="email-error"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Configuración de cuenta -->
                        <div class="form-section">
                            <h3 class="section-title">Configuración de Cuenta</h3>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="user-role">Rol *</label>
                                    <select id="user-role" name="role" required>
                                        <option value="">Seleccionar rol</option>
                                        <option value="operator">Operador</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                    <div class="field-error" id="role-error"></div>
                                    <div class="field-hint">
                                        <strong>Operador:</strong> Puede ver y actualizar tareas asignadas<br>
                                        <strong>Supervisor:</strong> Puede crear tareas y gestionar operadores<br>
                                        <strong>Administrador:</strong> Acceso completo al sistema
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            id="user-active" 
                                            name="isActive" 
                                            checked
                                        >
                                        <span class="checkbox-text">Usuario activo</span>
                                    </label>
                                    <div class="field-hint">
                                        Los usuarios inactivos no pueden acceder al sistema
                                    </div>
                                </div>
                            </div>
                        </div>

                        ${showPasswordFields ? `
                            <!-- Contraseña (solo en modo crear) -->
                            <div class="form-section">
                                <h3 class="section-title">Contraseña</h3>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="user-password">Contraseña *</label>
                                        <input 
                                            type="password" 
                                            id="user-password" 
                                            name="password" 
                                            required 
                                            minlength="6"
                                            placeholder="Mínimo 6 caracteres"
                                        >
                                        <div class="field-error" id="password-error"></div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="user-confirm-password">Confirmar contraseña *</label>
                                        <input 
                                            type="password" 
                                            id="user-confirm-password" 
                                            name="confirmPassword" 
                                            required 
                                            minlength="6"
                                            placeholder="Repita la contraseña"
                                        >
                                        <div class="field-error" id="confirmPassword-error"></div>
                                    </div>
                                </div>
                                
                                <div class="password-requirements">
                                    <h4>Requisitos de contraseña:</h4>
                                    <ul>
                                        <li>Mínimo 6 caracteres</li>
                                        <li>Se recomienda usar letras, números y símbolos</li>
                                        <li>Evitar información personal obvia</li>
                                    </ul>
                                </div>
                            </div>
                        ` : `
                            <!-- Cambio de contraseña (solo en modo editar) -->
                            <div class="form-section">
                                <h3 class="section-title">Cambiar Contraseña</h3>
                                
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            id="change-password-toggle"
                                        >
                                        <span class="checkbox-text">Cambiar contraseña</span>
                                    </label>
                                </div>
                                
                                <div id="password-fields" class="password-fields" style="display: none;">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="user-new-password">Nueva contraseña</label>
                                            <input 
                                                type="password" 
                                                id="user-new-password" 
                                                name="newPassword" 
                                                minlength="6"
                                                placeholder="Mínimo 6 caracteres"
                                            >
                                            <div class="field-error" id="newPassword-error"></div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label for="user-confirm-new-password">Confirmar nueva contraseña</label>
                                            <input 
                                                type="password" 
                                                id="user-confirm-new-password" 
                                                name="confirmNewPassword" 
                                                minlength="6"
                                                placeholder="Repita la nueva contraseña"
                                            >
                                            <div class="field-error" id="confirmNewPassword-error"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `}
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
        const form = document.getElementById('user-form') as HTMLFormElement;
        const closeButton = document.getElementById('close-form-button');
        const cancelButton = document.getElementById('cancel-button');

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

        // Validación en tiempo real
        this.setupRealTimeValidation();

        // Toggle de cambio de contraseña (solo en modo editar)
        if (this.mode === 'edit') {
            const changePasswordToggle = document.getElementById('change-password-toggle') as HTMLInputElement;
            const passwordFields = document.getElementById('password-fields') as HTMLElement;

            changePasswordToggle?.addEventListener('change', () => {
                if (passwordFields) {
                    passwordFields.style.display = changePasswordToggle.checked ? 'block' : 'none';
                    
                    // Actualizar required de los campos
                    const newPasswordField = document.getElementById('user-new-password') as HTMLInputElement;
                    const confirmNewPasswordField = document.getElementById('user-confirm-new-password') as HTMLInputElement;
                    
                    if (newPasswordField && confirmNewPasswordField) {
                        newPasswordField.required = changePasswordToggle.checked;
                        confirmNewPasswordField.required = changePasswordToggle.checked;
                    }
                }
            });
        }
    }

    /**
     * Configurar validación en tiempo real
     */
    private setupRealTimeValidation(): void {
        const fields = ['name', 'email'];
        
        fields.forEach(fieldName => {
            const field = document.getElementById(`user-${fieldName}`) as HTMLInputElement;
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(fieldName);
                });
                
                field.addEventListener('input', () => {
                    this.clearFieldError(fieldName);
                });
            }
        });

        // Validación especial para contraseñas
        const passwordField = document.getElementById('user-password') as HTMLInputElement;
        const confirmPasswordField = document.getElementById('user-confirm-password') as HTMLInputElement;
        const newPasswordField = document.getElementById('user-new-password') as HTMLInputElement;
        const confirmNewPasswordField = document.getElementById('user-confirm-new-password') as HTMLInputElement;

        [passwordField, confirmPasswordField, newPasswordField, confirmNewPasswordField].forEach(field => {
            if (field) {
                field.addEventListener('blur', () => {
                    this.validatePasswords();
                });
            }
        });
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
            const savedUser = await this.saveUser(formData);
            
            // Notificar éxito
            if (this.onSave) {
                this.onSave(savedUser);
            }
            
            console.log('✅ Usuario guardado exitosamente:', savedUser.name);
            
        } catch (error) {
            console.error('❌ Error guardando usuario:', error);
            
            let errorMessage = 'Error al guardar el usuario';
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
    private getFormData(): UserFormData {
        const form = document.getElementById('user-form') as HTMLFormElement;
        const formData = new FormData(form);
        
        const data: UserFormData = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            role: formData.get('role') as 'operator' | 'supervisor' | 'admin',
            isActive: formData.get('isActive') === 'on'
        };

        // Agregar contraseñas según el modo
        if (this.mode === 'create') {
            data.password = formData.get('password') as string;
            data.confirmPassword = formData.get('confirmPassword') as string;
        } else {
            const changePasswordToggle = document.getElementById('change-password-toggle') as HTMLInputElement;
            if (changePasswordToggle?.checked) {
                data.password = formData.get('newPassword') as string;
                data.confirmPassword = formData.get('confirmNewPassword') as string;
            }
        }
        
        return data;
    }

    /**
     * Validar formulario
     */
    private validateForm(formData: UserFormData): string[] {
        const errors: string[] = [];
        
        // Validar nombre
        if (!formData.name || formData.name.trim().length === 0) {
            errors.push('El nombre es requerido');
        } else if (formData.name.length > 100) {
            errors.push('El nombre no puede exceder 100 caracteres');
        }

        // Validar email
        if (!formData.email || formData.email.trim().length === 0) {
            errors.push('El correo electrónico es requerido');
        } else if (!this.isValidEmail(formData.email)) {
            errors.push('El correo electrónico no es válido');
        } else if (formData.email.length > 255) {
            errors.push('El correo electrónico no puede exceder 255 caracteres');
        }

        // Validar rol
        if (!formData.role) {
            errors.push('El rol es requerido');
        }

        // Validar contraseñas
        if (formData.password !== undefined) {
            if (!formData.password || formData.password.length === 0) {
                errors.push('La contraseña es requerida');
            } else if (formData.password.length < 6) {
                errors.push('La contraseña debe tener al menos 6 caracteres');
            }

            if (formData.password !== formData.confirmPassword) {
                errors.push('Las contraseñas no coinciden');
            }
        }
        
        return errors;
    }

    /**
     * Validar campo individual
     */
    private validateField(fieldName: string): boolean {
        const field = document.getElementById(`user-${fieldName}`) as HTMLInputElement;
        if (!field) return true;
        
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        switch (fieldName) {
            case 'name':
                if (!value) {
                    errorMessage = 'El nombre es requerido';
                    isValid = false;
                } else if (value.length > 100) {
                    errorMessage = 'El nombre no puede exceder 100 caracteres';
                    isValid = false;
                }
                break;
                
            case 'email':
                if (!value) {
                    errorMessage = 'El correo electrónico es requerido';
                    isValid = false;
                } else if (!this.isValidEmail(value)) {
                    errorMessage = 'El correo electrónico no es válido';
                    isValid = false;
                } else if (value.length > 255) {
                    errorMessage = 'El correo electrónico no puede exceder 255 caracteres';
                    isValid = false;
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
     * Validar contraseñas
     */
    private validatePasswords(): boolean {
        const passwordField = document.getElementById('user-password') as HTMLInputElement;
        const confirmPasswordField = document.getElementById('user-confirm-password') as HTMLInputElement;
        const newPasswordField = document.getElementById('user-new-password') as HTMLInputElement;
        const confirmNewPasswordField = document.getElementById('user-confirm-new-password') as HTMLInputElement;

        let password = '';
        let confirmPassword = '';
        let passwordFieldName = 'password';
        let confirmPasswordFieldName = 'confirmPassword';

        if (this.mode === 'create') {
            password = passwordField?.value || '';
            confirmPassword = confirmPasswordField?.value || '';
        } else {
            const changePasswordToggle = document.getElementById('change-password-toggle') as HTMLInputElement;
            if (changePasswordToggle?.checked) {
                password = newPasswordField?.value || '';
                confirmPassword = confirmNewPasswordField?.value || '';
                passwordFieldName = 'newPassword';
                confirmPasswordFieldName = 'confirmNewPassword';
            } else {
                return true; // No validar si no se está cambiando la contraseña
            }
        }

        let isValid = true;

        // Validar contraseña
        if (password.length > 0 && password.length < 6) {
            this.showFieldError(passwordFieldName, 'La contraseña debe tener al menos 6 caracteres');
            isValid = false;
        } else {
            this.clearFieldError(passwordFieldName);
        }

        // Validar confirmación
        if (password !== confirmPassword && confirmPassword.length > 0) {
            this.showFieldError(confirmPasswordFieldName, 'Las contraseñas no coinciden');
            isValid = false;
        } else {
            this.clearFieldError(confirmPasswordFieldName);
        }

        return isValid;
    }

    /**
     * Guardar usuario
     */
    private async saveUser(formData: UserFormData): Promise<User> {
        const url = this.mode === 'create' ? '/api/users' : `/api/users/${this.user!.id}`;
        const method = this.mode === 'create' ? 'POST' : 'PUT';
        
        // Preparar datos para enviar
        const requestData: any = {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            isActive: formData.isActive
        };

        // Agregar contraseña si está presente
        if (formData.password) {
            requestData.password = formData.password;
        }
        
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.user;
    }

    /**
     * Validar formato de email
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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
            if (error.includes('nombre')) {
                this.showFieldError('name', error);
            } else if (error.includes('correo') || error.includes('email')) {
                this.showFieldError('email', error);
            } else if (error.includes('rol')) {
                this.showFieldError('role', error);
            } else if (error.includes('contraseña')) {
                if (this.mode === 'create') {
                    this.showFieldError('password', error);
                } else {
                    this.showFieldError('newPassword', error);
                }
            }
        });
    }

    /**
     * Mostrar error en campo específico
     */
    private showFieldError(fieldName: string, message: string): void {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const field = document.getElementById(`user-${fieldName}`) || document.getElementById(fieldName);
        
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
        const field = document.getElementById(`user-${fieldName}`) || document.getElementById(fieldName);
        
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
        const form = document.getElementById('user-form') as HTMLFormElement;
        
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
        this.user = null;
        this.render();
        this.setupEventListeners();
    }

    /**
     * Establecer modo de edición
     */
    public setEditMode(user: User): void {
        this.mode = 'edit';
        this.user = user;
        this.render();
        this.setupEventListeners();
        this.populateForm(user);
    }

    /**
     * Poblar formulario con datos de usuario
     */
    private populateForm(user: User): void {
        this.setFieldValue('user-name', user.name);
        this.setFieldValue('user-email', user.email);
        this.setFieldValue('user-role', user.role);
        
        const activeCheckbox = document.getElementById('user-active') as HTMLInputElement;
        if (activeCheckbox) {
            activeCheckbox.checked = user.isActive;
        }
    }

    /**
     * Establecer valor de campo
     */
    private setFieldValue(fieldId: string, value: string): void {
        const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement;
        if (field) {
            field.value = value;
        }
    }

    /**
     * Resetear formulario
     */
    public reset(): void {
        const form = document.getElementById('user-form') as HTMLFormElement;
        if (form) {
            form.reset();
        }
        
        // Limpiar errores
        this.clearAllErrors();
        
        // Resetear estado
        this.user = null;
        this.mode = 'create';
        this.isLoading = false;
    }

    /**
     * Obtener usuario actual (en modo edición)
     */
    public getCurrentUser(): User | null {
        return this.user;
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