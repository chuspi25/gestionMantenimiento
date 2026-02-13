import { validateEmail, validateRequired, validatePassword } from './types.js';
import { API_BASE_URL } from './config.js';
/**
 * Clase para manejar la autenticación del frontend
 */
export class AuthManager {
    token = null;
    user = null;
    refreshTimer = null;
    constructor() {
        this.loadStoredAuth();
        console.log('🔐 AuthManager inicializado. Token disponible:', !!this.token, 'Usuario:', this.user?.name);
    }
    /**
     * Cargar datos de autenticación almacenados
     */
    loadStoredAuth() {
        try {
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');
            const tokenExpiry = localStorage.getItem('auth_expiry');
            if (storedToken && storedUser && tokenExpiry) {
                const expiryTime = parseInt(tokenExpiry);
                if (Date.now() < expiryTime) {
                    this.token = storedToken;
                    this.user = JSON.parse(storedUser);
                    this.scheduleTokenRefresh(expiryTime - Date.now());
                }
                else {
                    this.clearStoredAuth();
                }
            }
        }
        catch (error) {
            console.error('Error cargando autenticación almacenada:', error);
            this.clearStoredAuth();
        }
    }
    /**
     * Almacenar datos de autenticación
     */
    storeAuth(token, user, expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('auth_expiry', expiryTime.toString());
        this.scheduleTokenRefresh(expiresIn * 1000 - 60000); // Renovar 1 minuto antes
    }
    /**
     * Limpiar datos de autenticación almacenados
     */
    clearStoredAuth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_expiry');
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    /**
     * Programar renovación automática del token
     */
    scheduleTokenRefresh(_delay) {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        // Deshabilitado temporalmente - el sistema no usa refresh tokens actualmente
        /*
        this.refreshTimer = window.setTimeout(async () => {
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('Error renovando token:', error);
            this.logout();
          }
        }, delay);
        */
    }
    /**
     * Validar formulario de login
     */
    validateLoginForm(email, password) {
        const errors = [];
        // Validar email
        if (!validateRequired(email)) {
            errors.push({ field: 'email', message: 'El correo electrónico es requerido' });
        }
        else if (!validateEmail(email)) {
            errors.push({ field: 'email', message: 'El correo electrónico no es válido' });
        }
        // Validar contraseña
        if (!validateRequired(password)) {
            errors.push({ field: 'password', message: 'La contraseña es requerida' });
        }
        else if (!validatePassword(password)) {
            errors.push({ field: 'password', message: 'La contraseña debe tener al menos 6 caracteres' });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Realizar login
     */
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, rememberMe }),
            });
            // Obtener el texto de la respuesta primero
            const responseText = await response.text();
            // Verificar si la respuesta está vacía
            if (!responseText || responseText.trim() === '') {
                throw new Error('El servidor devolvió una respuesta vacía. Verifica que el servidor esté corriendo correctamente.');
            }
            // Intentar parsear como JSON
            let data;
            try {
                data = JSON.parse(responseText);
            }
            catch (parseError) {
                console.error('Error parseando respuesta:', responseText);
                throw new Error(`Respuesta del servidor no es JSON válido: ${responseText.substring(0, 100)}`);
            }
            if (!response.ok) {
                throw new Error(data.message || 'Error en el login');
            }
            if (!data.success || !data.data) {
                throw new Error('Respuesta inválida del servidor');
            }
            const { user, token, expiresIn } = data.data;
            this.token = token;
            this.user = user;
            if (rememberMe) {
                this.storeAuth(token, user, expiresIn);
            }
            // Disparar evento personalizado
            window.dispatchEvent(new CustomEvent('user-login', { detail: user }));
            return data.data;
        }
        catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }
    /**
     * Realizar logout
     */
    async logout() {
        try {
            if (this.token) {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
        }
        catch (error) {
            console.error('Error en logout:', error);
        }
        finally {
            this.token = null;
            this.user = null;
            this.clearStoredAuth();
            // Disparar evento personalizado
            window.dispatchEvent(new CustomEvent('user-logout'));
        }
    }
    /**
     * Renovar token
     */
    async refreshToken() {
        if (!this.token) {
            throw new Error('No hay token para renovar');
        }
        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (!response.ok || !data.success || !data.data) {
                throw new Error('Error renovando token');
            }
            this.token = data.data.token;
            if (this.user) {
                this.storeAuth(data.data.token, this.user, data.data.expiresIn);
            }
        }
        catch (error) {
            console.error('Error renovando token:', error);
            throw error;
        }
    }
    /**
     * Verificar si el usuario está autenticado
     */
    isAuthenticated() {
        return this.token !== null && this.user !== null;
    }
    /**
     * Obtener usuario actual
     */
    getCurrentUser() {
        return this.user;
    }
    /**
     * Obtener token actual
     */
    getToken() {
        return this.token;
    }
    /**
     * Verificar si el usuario tiene un rol específico
     */
    hasRole(role) {
        return this.user?.role === role;
    }
    /**
     * Verificar si el usuario tiene al menos un rol específico
     */
    hasMinimumRole(role) {
        if (!this.user)
            return false;
        const roleHierarchy = {
            'operator': 1,
            'supervisor': 2,
            'admin': 3
        };
        return roleHierarchy[this.user.role] >= roleHierarchy[role];
    }
    /**
     * Obtener headers de autorización para requests
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
}
/**
 * Clase para manejar la validación del formulario de login
 */
export class LoginFormValidator {
    form;
    emailInput;
    passwordInput;
    emailError;
    passwordError;
    generalError;
    constructor(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            throw new Error(`Formulario con ID '${formId}' no encontrado`);
        }
        this.form = form;
        this.emailInput = form.querySelector('#email');
        this.passwordInput = form.querySelector('#password');
        this.emailError = form.querySelector('#email-error');
        this.passwordError = form.querySelector('#password-error');
        this.generalError = form.querySelector('#login-error');
        this.setupValidation();
    }
    /**
     * Configurar validación en tiempo real
     */
    setupValidation() {
        // Validación en tiempo real para email
        this.emailInput.addEventListener('blur', () => {
            this.validateEmailField();
        });
        this.emailInput.addEventListener('input', () => {
            if (this.emailInput.classList.contains('error')) {
                this.validateEmailField();
            }
        });
        // Validación en tiempo real para contraseña
        this.passwordInput.addEventListener('blur', () => {
            this.validatePasswordField();
        });
        this.passwordInput.addEventListener('input', () => {
            if (this.passwordInput.classList.contains('error')) {
                this.validatePasswordField();
            }
        });
    }
    /**
     * Validar campo de email
     */
    validateEmailField() {
        const email = this.emailInput.value.trim();
        let isValid = true;
        let errorMessage = '';
        if (!validateRequired(email)) {
            isValid = false;
            errorMessage = 'El correo electrónico es requerido';
        }
        else if (!validateEmail(email)) {
            isValid = false;
            errorMessage = 'El correo electrónico no es válido';
        }
        this.setFieldError(this.emailInput, this.emailError, isValid ? '' : errorMessage);
        return isValid;
    }
    /**
     * Validar campo de contraseña
     */
    validatePasswordField() {
        const password = this.passwordInput.value;
        let isValid = true;
        let errorMessage = '';
        if (!validateRequired(password)) {
            isValid = false;
            errorMessage = 'La contraseña es requerida';
        }
        else if (!validatePassword(password)) {
            isValid = false;
            errorMessage = 'La contraseña debe tener al menos 6 caracteres';
        }
        this.setFieldError(this.passwordInput, this.passwordError, isValid ? '' : errorMessage);
        return isValid;
    }
    /**
     * Establecer error en un campo
     */
    setFieldError(input, errorElement, message) {
        if (message) {
            input.classList.add('error');
            errorElement.textContent = message;
            errorElement.setAttribute('aria-live', 'polite');
        }
        else {
            input.classList.remove('error');
            errorElement.textContent = '';
            errorElement.removeAttribute('aria-live');
        }
    }
    /**
     * Validar todo el formulario
     */
    validateForm() {
        const emailValid = this.validateEmailField();
        const passwordValid = this.validatePasswordField();
        const isValid = emailValid && passwordValid;
        return {
            isValid,
            errors: [] // Los errores ya se muestran en los campos individuales
        };
    }
    /**
     * Obtener datos del formulario
     */
    getFormData() {
        return {
            email: this.emailInput.value.trim(),
            password: this.passwordInput.value
        };
    }
    /**
     * Mostrar error general
     */
    showGeneralError(message) {
        this.generalError.textContent = message;
        this.generalError.setAttribute('aria-live', 'assertive');
    }
    /**
     * Limpiar error general
     */
    clearGeneralError() {
        this.generalError.textContent = '';
        this.generalError.removeAttribute('aria-live');
    }
    /**
     * Limpiar todos los errores
     */
    clearAllErrors() {
        this.setFieldError(this.emailInput, this.emailError, '');
        this.setFieldError(this.passwordInput, this.passwordError, '');
        this.clearGeneralError();
    }
    /**
     * Resetear formulario
     */
    reset() {
        this.form.reset();
        this.clearAllErrors();
    }
}
