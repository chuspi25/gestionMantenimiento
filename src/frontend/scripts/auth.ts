import { User, LoginForm, ApiResponse, validateEmail, validateRequired, validatePassword } from './types.js';
import { API_BASE_URL } from './config.js';

// Tipos específicos para autenticación
export interface LoginResponse {
  user: User;
  token: string;
  expiresIn: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Clase para manejar la autenticación del frontend
 */
export class AuthManager {
  private token: string | null = null;
  private user: User | null = null;
  private refreshTimer: number | null = null;

  constructor() {
    this.loadStoredAuth();
    console.log('🔐 AuthManager inicializado. Token disponible:', !!this.token, 'Usuario:', this.user?.name);
  }

  /**
   * Cargar datos de autenticación almacenados
   */
  private loadStoredAuth(): void {
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
        } else {
          this.clearStoredAuth();
        }
      }
    } catch (error) {
      console.error('Error cargando autenticación almacenada:', error);
      this.clearStoredAuth();
    }
  }

  /**
   * Almacenar datos de autenticación
   */
  private storeAuth(token: string, user: User, expiresIn: number): void {
    const expiryTime = Date.now() + (expiresIn * 1000);
    
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_expiry', expiryTime.toString());
    
    this.scheduleTokenRefresh(expiresIn * 1000 - 60000); // Renovar 1 minuto antes
  }

  /**
   * Limpiar datos de autenticación almacenados
   */
  private clearStoredAuth(): void {
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
  private scheduleTokenRefresh(_delay: number): void {
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
  validateLoginForm(email: string, password: string): FormValidationResult {
    const errors: ValidationError[] = [];

    // Validar email
    if (!validateRequired(email)) {
      errors.push({ field: 'email', message: 'El correo electrónico es requerido' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'El correo electrónico no es válido' });
    }

    // Validar contraseña
    if (!validateRequired(password)) {
      errors.push({ field: 'password', message: 'La contraseña es requerida' });
    } else if (!validatePassword(password)) {
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
  async login(email: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> {
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
      let data: ApiResponse<LoginResponse>;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
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
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  /**
   * Realizar logout
   */
  async logout(): Promise<void> {
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
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
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
  async refreshToken(): Promise<void> {
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

      const data: ApiResponse<{ token: string; expiresIn: number }> = await response.json();

      if (!response.ok || !data.success || !data.data) {
        throw new Error('Error renovando token');
      }

      this.token = data.data.token;
      
      if (this.user) {
        this.storeAuth(data.data.token, this.user, data.data.expiresIn);
      }
    } catch (error) {
      console.error('Error renovando token:', error);
      throw error;
    }
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.user;
  }

  /**
   * Obtener token actual
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(role: User['role']): boolean {
    return this.user?.role === role;
  }

  /**
   * Verificar si el usuario tiene al menos un rol específico
   */
  hasMinimumRole(role: User['role']): boolean {
    if (!this.user) return false;
    
    const roleHierarchy: Record<User['role'], number> = {
      'operator': 1,
      'supervisor': 2,
      'admin': 3
    };
    
    return roleHierarchy[this.user.role] >= roleHierarchy[role];
  }

  /**
   * Obtener headers de autorización para requests
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
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
  private form: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private emailError: HTMLElement;
  private passwordError: HTMLElement;
  private generalError: HTMLElement;

  constructor(formId: string) {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) {
      throw new Error(`Formulario con ID '${formId}' no encontrado`);
    }

    this.form = form;
    this.emailInput = form.querySelector('#email') as HTMLInputElement;
    this.passwordInput = form.querySelector('#password') as HTMLInputElement;
    this.emailError = form.querySelector('#email-error') as HTMLElement;
    this.passwordError = form.querySelector('#password-error') as HTMLElement;
    this.generalError = form.querySelector('#login-error') as HTMLElement;

    this.setupValidation();
  }

  /**
   * Configurar validación en tiempo real
   */
  private setupValidation(): void {
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
  private validateEmailField(): boolean {
    const email = this.emailInput.value.trim();
    let isValid = true;
    let errorMessage = '';

    if (!validateRequired(email)) {
      isValid = false;
      errorMessage = 'El correo electrónico es requerido';
    } else if (!validateEmail(email)) {
      isValid = false;
      errorMessage = 'El correo electrónico no es válido';
    }

    this.setFieldError(this.emailInput, this.emailError, isValid ? '' : errorMessage);
    return isValid;
  }

  /**
   * Validar campo de contraseña
   */
  private validatePasswordField(): boolean {
    const password = this.passwordInput.value;
    let isValid = true;
    let errorMessage = '';

    if (!validateRequired(password)) {
      isValid = false;
      errorMessage = 'La contraseña es requerida';
    } else if (!validatePassword(password)) {
      isValid = false;
      errorMessage = 'La contraseña debe tener al menos 6 caracteres';
    }

    this.setFieldError(this.passwordInput, this.passwordError, isValid ? '' : errorMessage);
    return isValid;
  }

  /**
   * Establecer error en un campo
   */
  private setFieldError(input: HTMLInputElement, errorElement: HTMLElement, message: string): void {
    if (message) {
      input.classList.add('error');
      errorElement.textContent = message;
      errorElement.setAttribute('aria-live', 'polite');
    } else {
      input.classList.remove('error');
      errorElement.textContent = '';
      errorElement.removeAttribute('aria-live');
    }
  }

  /**
   * Validar todo el formulario
   */
  validateForm(): FormValidationResult {
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
  getFormData(): LoginForm {
    return {
      email: this.emailInput.value.trim(),
      password: this.passwordInput.value
    };
  }

  /**
   * Mostrar error general
   */
  showGeneralError(message: string): void {
    this.generalError.textContent = message;
    this.generalError.setAttribute('aria-live', 'assertive');
  }

  /**
   * Limpiar error general
   */
  clearGeneralError(): void {
    this.generalError.textContent = '';
    this.generalError.removeAttribute('aria-live');
  }

  /**
   * Limpiar todos los errores
   */
  clearAllErrors(): void {
    this.setFieldError(this.emailInput, this.emailError, '');
    this.setFieldError(this.passwordInput, this.passwordError, '');
    this.clearGeneralError();
  }

  /**
   * Resetear formulario
   */
  reset(): void {
    this.form.reset();
    this.clearAllErrors();
  }
}