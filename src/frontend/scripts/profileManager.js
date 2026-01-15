import { authManager } from './main.js';
/**
 * Componente ProfileManager para gestión del perfil de usuario
 */
export class ProfileManager {
    container;
    user = null;
    // isLoading available for future use
    activeTab = 'profile';
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        this.container = container;
        this.initialize();
    }
    /**
     * Inicializar el componente
     */
    initialize() {
        this.user = authManager.getCurrentUser();
        this.render();
        this.setupEventListeners();
    }
    /**
     * Renderizar la estructura del componente
     */
    render() {
        if (!this.user) {
            this.renderNotAuthenticated();
            return;
        }
        this.container.innerHTML = `
            <div class="profile-manager-component">
                <!-- Header del perfil -->
                <div class="profile-header">
                    <div class="profile-avatar">
                        <div class="avatar-circle">
                            ${this.user.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div class="profile-info">
                        <h2 class="profile-name">${this.escapeHtml(this.user.name)}</h2>
                        <p class="profile-email">${this.escapeHtml(this.user.email)}</p>
                        <span class="profile-role role-${this.user.role}">
                            ${this.getRoleLabel(this.user.role)}
                        </span>
                    </div>
                </div>

                <!-- Navegación de pestañas -->
                <div class="profile-tabs">
                    <button class="tab-button ${this.activeTab === 'profile' ? 'active' : ''}" 
                            data-tab="profile" id="profile-tab">
                        👤 Información Personal
                    </button>
                    <button class="tab-button ${this.activeTab === 'password' ? 'active' : ''}" 
                            data-tab="password" id="password-tab">
                        🔒 Cambiar Contraseña
                    </button>
                </div>

                <!-- Contenido de las pestañas -->
                <div class="profile-content">
                    ${this.renderProfileTab()}
                    ${this.renderPasswordTab()}
                </div>

                <!-- Mensajes -->
                <div id="profile-messages" class="profile-messages"></div>
            </div>
        `;
    }
    /**
     * Renderizar pestaña de perfil
     */
    renderProfileTab() {
        const isVisible = this.activeTab === 'profile';
        const lastLogin = this.user?.lastLogin ? new Date(this.user.lastLogin) : null;
        const createdDate = new Date(this.user.createdAt);
        return `
            <div class="tab-content profile-tab-content" style="display: ${isVisible ? 'block' : 'none'}">
                <form id="profile-form" class="profile-form">
                    <div class="form-section">
                        <h3 class="section-title">Información Personal</h3>
                        
                        <div class="form-group">
                            <label for="profile-name">Nombre completo</label>
                            <input 
                                type="text" 
                                id="profile-name" 
                                name="name" 
                                value="${this.escapeHtml(this.user.name)}"
                                maxlength="100"
                                required
                            >
                            <div class="field-error" id="profile-name-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="profile-email">Correo electrónico</label>
                            <input 
                                type="email" 
                                id="profile-email" 
                                name="email" 
                                value="${this.escapeHtml(this.user.email)}"
                                maxlength="255"
                                required
                            >
                            <div class="field-error" id="profile-email-error"></div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3 class="section-title">Información de Cuenta</h3>
                        
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Rol</span>
                                <span class="info-value">
                                    <span class="role-badge role-${this.user.role}">
                                        ${this.getRoleLabel(this.user.role)}
                                    </span>
                                </span>
                            </div>
                            
                            <div class="info-item">
                                <span class="info-label">Estado</span>
                                <span class="info-value">
                                    <span class="status-badge ${this.user.isActive ? 'active' : 'inactive'}">
                                        ${this.user.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </span>
                            </div>
                            
                            <div class="info-item">
                                <span class="info-label">Fecha de registro</span>
                                <span class="info-value">
                                    ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}
                                </span>
                            </div>
                            
                            <div class="info-item">
                                <span class="info-label">Último acceso</span>
                                <span class="info-value">
                                    ${lastLogin ?
            `${lastLogin.toLocaleDateString()} ${lastLogin.toLocaleTimeString()}` :
            'Nunca'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="primary-button" id="save-profile-button">
                            <span class="button-text">Guardar Cambios</span>
                            <div class="button-spinner" style="display: none;">
                                <div class="spinner"></div>
                            </div>
                        </button>
                        <button type="button" class="secondary-button" id="reset-profile-button">
                            Descartar Cambios
                        </button>
                    </div>
                </form>
            </div>
        `;
    }
    /**
     * Renderizar pestaña de contraseña
     */
    renderPasswordTab() {
        const isVisible = this.activeTab === 'password';
        return `
            <div class="tab-content password-tab-content" style="display: ${isVisible ? 'block' : 'none'}">
                <form id="password-form" class="password-form">
                    <div class="form-section">
                        <h3 class="section-title">Cambiar Contraseña</h3>
                        
                        <div class="form-group">
                            <label for="current-password">Contraseña actual</label>
                            <input 
                                type="password" 
                                id="current-password" 
                                name="currentPassword" 
                                required
                                placeholder="Ingrese su contraseña actual"
                            >
                            <div class="field-error" id="current-password-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="new-password">Nueva contraseña</label>
                            <input 
                                type="password" 
                                id="new-password" 
                                name="newPassword" 
                                required
                                minlength="6"
                                placeholder="Mínimo 6 caracteres"
                            >
                            <div class="field-error" id="new-password-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-new-password">Confirmar nueva contraseña</label>
                            <input 
                                type="password" 
                                id="confirm-new-password" 
                                name="confirmPassword" 
                                required
                                minlength="6"
                                placeholder="Repita la nueva contraseña"
                            >
                            <div class="field-error" id="confirm-new-password-error"></div>
                        </div>
                        
                        <div class="password-requirements">
                            <h4>Requisitos de contraseña:</h4>
                            <ul>
                                <li>Mínimo 6 caracteres</li>
                                <li>Se recomienda usar letras, números y símbolos</li>
                                <li>Debe ser diferente a la contraseña actual</li>
                            </ul>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="primary-button" id="change-password-button">
                            <span class="button-text">Cambiar Contraseña</span>
                            <div class="button-spinner" style="display: none;">
                                <div class="spinner"></div>
                            </div>
                        </button>
                        <button type="button" class="secondary-button" id="reset-password-button">
                            Limpiar Campos
                        </button>
                    </div>
                </form>
            </div>
        `;
    }
    /**
     * Renderizar estado no autenticado
     */
    renderNotAuthenticated() {
        this.container.innerHTML = `
            <div class="profile-not-authenticated">
                <div class="not-auth-content">
                    <div class="not-auth-icon">🔒</div>
                    <h3>Acceso Requerido</h3>
                    <p>Debe iniciar sesión para acceder a su perfil.</p>
                    <button class="login-button" onclick="window.location.href = '/login'">
                        Iniciar Sesión
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        if (!this.user)
            return;
        // Pestañas
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target;
                const tab = target.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });
        // Formulario de perfil
        const profileForm = document.getElementById('profile-form');
        profileForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileSubmit();
        });
        const resetProfileButton = document.getElementById('reset-profile-button');
        resetProfileButton?.addEventListener('click', () => {
            this.resetProfileForm();
        });
        // Formulario de contraseña
        const passwordForm = document.getElementById('password-form');
        passwordForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordSubmit();
        });
        const resetPasswordButton = document.getElementById('reset-password-button');
        resetPasswordButton?.addEventListener('click', () => {
            this.resetPasswordForm();
        });
        // Validación en tiempo real
        this.setupRealTimeValidation();
    }
    /**
     * Configurar validación en tiempo real
     */
    setupRealTimeValidation() {
        // Validación del perfil
        const profileNameField = document.getElementById('profile-name');
        const profileEmailField = document.getElementById('profile-email');
        [profileNameField, profileEmailField].forEach(field => {
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateProfileField(field.name);
                });
                field.addEventListener('input', () => {
                    this.clearFieldError(`profile-${field.name}`);
                });
            }
        });
        // Validación de contraseñas
        const passwordFields = ['new-password', 'confirm-new-password'];
        passwordFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validatePasswordFields();
                });
            }
        });
    }
    /**
     * Cambiar pestaña activa
     */
    switchTab(tab) {
        this.activeTab = tab;
        // Actualizar botones de pestaña
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });
        // Mostrar/ocultar contenido
        const profileContent = document.querySelector('.profile-tab-content');
        const passwordContent = document.querySelector('.password-tab-content');
        if (profileContent) {
            profileContent.style.display = tab === 'profile' ? 'block' : 'none';
        }
        if (passwordContent) {
            passwordContent.style.display = tab === 'password' ? 'block' : 'none';
        }
    }
    /**
     * Manejar envío del formulario de perfil
     */
    async handleProfileSubmit() {
        try {
            this.clearAllErrors();
            const formData = this.getProfileFormData();
            const validationErrors = this.validateProfileData(formData);
            if (validationErrors.length > 0) {
                this.showValidationErrors(validationErrors);
                return;
            }
            this.setProfileLoading(true);
            const updatedUser = await this.saveProfile(formData);
            // Actualizar usuario local
            this.user = updatedUser;
            // Actualizar authManager
            // authManager.updateCurrentUser(updatedUser);
            this.showMessage('Perfil actualizado exitosamente', 'success');
        }
        catch (error) {
            console.error('Error actualizando perfil:', error);
            this.showMessage('Error al actualizar el perfil', 'error');
        }
        finally {
            this.setProfileLoading(false);
        }
    }
    /**
     * Manejar envío del formulario de contraseña
     */
    async handlePasswordSubmit() {
        try {
            this.clearAllErrors();
            const formData = this.getPasswordFormData();
            const validationErrors = this.validatePasswordData(formData);
            if (validationErrors.length > 0) {
                this.showValidationErrors(validationErrors);
                return;
            }
            this.setPasswordLoading(true);
            await this.changePassword(formData);
            this.showMessage('Contraseña cambiada exitosamente', 'success');
            this.resetPasswordForm();
        }
        catch (error) {
            console.error('Error cambiando contraseña:', error);
            this.showMessage('Error al cambiar la contraseña', 'error');
        }
        finally {
            this.setPasswordLoading(false);
        }
    }
    /**
     * Obtener datos del formulario de perfil
     */
    getProfileFormData() {
        const nameField = document.getElementById('profile-name');
        const emailField = document.getElementById('profile-email');
        return {
            name: nameField.value.trim(),
            email: emailField.value.trim()
        };
    }
    /**
     * Obtener datos del formulario de contraseña
     */
    getPasswordFormData() {
        const currentPasswordField = document.getElementById('current-password');
        const newPasswordField = document.getElementById('new-password');
        const confirmPasswordField = document.getElementById('confirm-new-password');
        return {
            name: '', // No usado en cambio de contraseña
            email: '', // No usado en cambio de contraseña
            currentPassword: currentPasswordField.value,
            newPassword: newPasswordField.value,
            confirmPassword: confirmPasswordField.value
        };
    }
    /**
     * Validar datos del perfil
     */
    validateProfileData(data) {
        const errors = [];
        if (!data.name || data.name.length === 0) {
            errors.push('El nombre es requerido');
        }
        else if (data.name.length > 100) {
            errors.push('El nombre no puede exceder 100 caracteres');
        }
        if (!data.email || data.email.length === 0) {
            errors.push('El correo electrónico es requerido');
        }
        else if (!this.isValidEmail(data.email)) {
            errors.push('El correo electrónico no es válido');
        }
        else if (data.email.length > 255) {
            errors.push('El correo electrónico no puede exceder 255 caracteres');
        }
        return errors;
    }
    /**
     * Validar datos de contraseña
     */
    validatePasswordData(data) {
        const errors = [];
        if (!data.currentPassword) {
            errors.push('La contraseña actual es requerida');
        }
        if (!data.newPassword) {
            errors.push('La nueva contraseña es requerida');
        }
        else if (data.newPassword.length < 6) {
            errors.push('La nueva contraseña debe tener al menos 6 caracteres');
        }
        if (data.newPassword !== data.confirmPassword) {
            errors.push('Las contraseñas no coinciden');
        }
        if (data.currentPassword === data.newPassword) {
            errors.push('La nueva contraseña debe ser diferente a la actual');
        }
        return errors;
    }
    /**
     * Validar campo del perfil
     */
    validateProfileField(fieldName) {
        const field = document.getElementById(`profile-${fieldName}`);
        if (!field)
            return true;
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        switch (fieldName) {
            case 'name':
                if (!value) {
                    errorMessage = 'El nombre es requerido';
                    isValid = false;
                }
                else if (value.length > 100) {
                    errorMessage = 'El nombre no puede exceder 100 caracteres';
                    isValid = false;
                }
                break;
            case 'email':
                if (!value) {
                    errorMessage = 'El correo electrónico es requerido';
                    isValid = false;
                }
                else if (!this.isValidEmail(value)) {
                    errorMessage = 'El correo electrónico no es válido';
                    isValid = false;
                }
                else if (value.length > 255) {
                    errorMessage = 'El correo electrónico no puede exceder 255 caracteres';
                    isValid = false;
                }
                break;
        }
        if (!isValid) {
            this.showFieldError(`profile-${fieldName}`, errorMessage);
        }
        else {
            this.clearFieldError(`profile-${fieldName}`);
        }
        return isValid;
    }
    /**
     * Validar campos de contraseña
     */
    validatePasswordFields() {
        const newPasswordField = document.getElementById('new-password');
        const confirmPasswordField = document.getElementById('confirm-new-password');
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;
        let isValid = true;
        // Validar nueva contraseña
        if (newPassword.length > 0 && newPassword.length < 6) {
            this.showFieldError('new-password', 'La contraseña debe tener al menos 6 caracteres');
            isValid = false;
        }
        else {
            this.clearFieldError('new-password');
        }
        // Validar confirmación
        if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
            this.showFieldError('confirm-new-password', 'Las contraseñas no coinciden');
            isValid = false;
        }
        else {
            this.clearFieldError('confirm-new-password');
        }
        return isValid;
    }
    /**
     * Guardar perfil
     */
    async saveProfile(data) {
        const response = await fetch(`/api/users/${this.user.id}/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: data.name,
                email: data.email
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        return result.user;
    }
    /**
     * Cambiar contraseña
     */
    async changePassword(data) {
        const response = await fetch(`/api/users/${this.user.id}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authManager.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }
    }
    /**
     * Validar formato de email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Resetear formulario de perfil
     */
    resetProfileForm() {
        if (!this.user)
            return;
        const nameField = document.getElementById('profile-name');
        const emailField = document.getElementById('profile-email');
        if (nameField)
            nameField.value = this.user.name;
        if (emailField)
            emailField.value = this.user.email;
        this.clearAllErrors();
    }
    /**
     * Resetear formulario de contraseña
     */
    resetPasswordForm() {
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.reset();
        }
        this.clearAllErrors();
    }
    /**
     * Mostrar errores de validación
     */
    showValidationErrors(errors) {
        errors.forEach(error => {
            if (error.includes('nombre')) {
                this.showFieldError('profile-name', error);
            }
            else if (error.includes('correo') || error.includes('email')) {
                this.showFieldError('profile-email', error);
            }
            else if (error.includes('actual')) {
                this.showFieldError('current-password', error);
            }
            else if (error.includes('nueva contraseña')) {
                this.showFieldError('new-password', error);
            }
            else if (error.includes('contraseñas no coinciden')) {
                this.showFieldError('confirm-new-password', error);
            }
        });
        if (errors.length > 0) {
            this.showMessage(errors[0], 'error');
        }
    }
    /**
     * Mostrar error en campo específico
     */
    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        const field = document.getElementById(fieldId);
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
    clearFieldError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        const field = document.getElementById(fieldId);
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
        if (field) {
            field.classList.remove('error');
        }
    }
    /**
     * Limpiar todos los errores
     */
    clearAllErrors() {
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(element => {
            element.textContent = '';
            element.style.display = 'none';
        });
        const fields = document.querySelectorAll('.error');
        fields.forEach(field => {
            field.classList.remove('error');
        });
    }
    /**
     * Establecer estado de carga del perfil
     */
    setProfileLoading(loading) {
        const submitButton = document.getElementById('save-profile-button');
        const buttonText = submitButton?.querySelector('.button-text');
        const buttonSpinner = submitButton?.querySelector('.button-spinner');
        if (submitButton) {
            submitButton.disabled = loading;
            if (buttonText)
                buttonText.style.display = loading ? 'none' : 'block';
            if (buttonSpinner)
                buttonSpinner.style.display = loading ? 'flex' : 'none';
        }
    }
    /**
     * Establecer estado de carga de contraseña
     */
    setPasswordLoading(loading) {
        const submitButton = document.getElementById('change-password-button');
        const buttonText = submitButton?.querySelector('.button-text');
        const buttonSpinner = submitButton?.querySelector('.button-spinner');
        if (submitButton) {
            submitButton.disabled = loading;
            if (buttonText)
                buttonText.style.display = loading ? 'none' : 'block';
            if (buttonSpinner)
                buttonSpinner.style.display = loading ? 'flex' : 'none';
        }
    }
    /**
     * Mostrar mensaje
     */
    showMessage(message, type) {
        const messagesContainer = document.getElementById('profile-messages');
        if (!messagesContainer)
            return;
        const messageElement = document.createElement('div');
        messageElement.className = `profile-message ${type}`;
        messageElement.innerHTML = `
            <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="message-text">${message}</span>
            <button class="message-close" onclick="this.parentElement.remove()">✕</button>
        `;
        messagesContainer.appendChild(messageElement);
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
    }
    /**
     * Obtener etiqueta de rol
     */
    getRoleLabel(role) {
        const labels = {
            'operator': 'Operador',
            'supervisor': 'Supervisor',
            'admin': 'Administrador'
        };
        return labels[role] || role;
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
     * Refrescar el perfil
     */
    refresh() {
        this.user = authManager.getCurrentUser();
        this.render();
        this.setupEventListeners();
    }
    /**
     * Obtener usuario actual
     */
    getCurrentUser() {
        return this.user;
    }
}
