import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthManager, LoginFormValidator } from '../../src/frontend/scripts/auth.js';
import { User } from '../../src/frontend/scripts/types.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock window methods
Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(window, 'setTimeout', {
  value: vi.fn((callback) => {
    callback();
    return 1;
  }),
  writable: true,
});

Object.defineProperty(window, 'clearTimeout', {
  value: vi.fn(),
  writable: true,
});

describe('AuthManager', () => {
  let authManager: AuthManager;
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'operator',
    isActive: true,
    createdAt: new Date(),
    lastLogin: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authManager = new AuthManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize without stored auth data', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const manager = new AuthManager();
      
      expect(manager.isAuthenticated()).toBe(false);
      expect(manager.getCurrentUser()).toBeNull();
      expect(manager.getToken()).toBeNull();
    });

    it('should load valid stored auth data', () => {
      const token = 'valid-token';
      const expiryTime = Date.now() + 3600000; // 1 hour from now
      
      // Create a serialized version of mockUser (dates become strings when JSON.stringify/parse)
      const serializedUser = {
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        lastLogin: mockUser.lastLogin?.toISOString()
      };
      
      localStorageMock.getItem
        .mockReturnValueOnce(token)
        .mockReturnValueOnce(JSON.stringify(serializedUser))
        .mockReturnValueOnce(expiryTime.toString());
      
      const manager = new AuthManager();
      
      expect(manager.isAuthenticated()).toBe(true);
      expect(manager.getCurrentUser()).toEqual(serializedUser);
      expect(manager.getToken()).toBe(token);
    });

    it('should clear expired stored auth data', () => {
      const token = 'expired-token';
      const expiryTime = Date.now() - 3600000; // 1 hour ago
      
      localStorageMock.getItem
        .mockReturnValueOnce(token)
        .mockReturnValueOnce(JSON.stringify(mockUser))
        .mockReturnValueOnce(expiryTime.toString());
      
      const manager = new AuthManager();
      
      expect(manager.isAuthenticated()).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_expiry');
    });
  });

  describe('validateLoginForm', () => {
    it('should validate correct email and password', () => {
      const result = authManager.validateLoginForm('test@example.com', 'password123');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty email', () => {
      const result = authManager.validateLoginForm('', 'password123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'email',
        message: 'El correo electrónico es requerido'
      });
    });

    it('should reject invalid email format', () => {
      const result = authManager.validateLoginForm('invalid-email', 'password123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'email',
        message: 'El correo electrónico no es válido'
      });
    });

    it('should reject empty password', () => {
      const result = authManager.validateLoginForm('test@example.com', '');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'password',
        message: 'La contraseña es requerida'
      });
    });

    it('should reject short password', () => {
      const result = authManager.validateLoginForm('test@example.com', '123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'password',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const result = authManager.validateLoginForm('', '123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginResponse = {
        user: mockUser,
        token: 'new-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      const result = await authManager.login('test@example.com', 'password123', false);

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: false
        }),
      });

      expect(result).toEqual(loginResponse);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toEqual(mockUser);
      expect(authManager.getToken()).toBe('new-token');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-login',
          detail: mockUser
        })
      );
    });

    it('should store auth data when rememberMe is true', async () => {
      const loginResponse = {
        user: mockUser,
        token: 'new-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', true);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(mockUser));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_expiry', expect.any(String));
    });

    it('should not store auth data when rememberMe is false', async () => {
      const loginResponse = {
        user: mockUser,
        token: 'new-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', false);

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should throw error on failed login', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Credenciales inválidas'
        })
      });

      await expect(
        authManager.login('test@example.com', 'wrongpassword', false)
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw error on network failure', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        authManager.login('test@example.com', 'password123', false)
      ).rejects.toThrow('Network error');
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      // Setup authenticated state first
      const loginResponse = {
        user: mockUser,
        token: 'test-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', true);
      vi.clearAllMocks();

      // Now test logout
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await authManager.logout();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      });

      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBeNull();
      expect(authManager.getToken()).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_expiry');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-logout'
        })
      );
    });

    it('should clear local state even if logout request fails', async () => {
      // Setup authenticated state first
      const loginResponse = {
        user: mockUser,
        token: 'test-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', true);
      vi.clearAllMocks();

      // Now test logout with network error
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await authManager.logout();

      expect(authManager.isAuthenticated()).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-logout'
        })
      );
    });
  });

  describe('role checking', () => {
    beforeEach(async () => {
      const loginResponse = {
        user: mockUser,
        token: 'test-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', false);
    });

    it('should correctly identify user role', () => {
      expect(authManager.hasRole('operator')).toBe(true);
      expect(authManager.hasRole('supervisor')).toBe(false);
      expect(authManager.hasRole('admin')).toBe(false);
    });

    it('should correctly check minimum role requirements', () => {
      expect(authManager.hasMinimumRole('operator')).toBe(true);
      expect(authManager.hasMinimumRole('supervisor')).toBe(false);
      expect(authManager.hasMinimumRole('admin')).toBe(false);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return headers without token when not authenticated', () => {
      const headers = authManager.getAuthHeaders();
      
      expect(headers).toEqual({
        'Content-Type': 'application/json'
      });
    });

    it('should return headers with token when authenticated', async () => {
      const loginResponse = {
        user: mockUser,
        token: 'test-token',
        expiresIn: 3600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: loginResponse
        })
      });

      await authManager.login('test@example.com', 'password123', false);

      const headers = authManager.getAuthHeaders();
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      });
    });
  });
});

describe('LoginFormValidator', () => {
  let validator: LoginFormValidator;
  let mockForm: HTMLFormElement;
  let mockEmailInput: HTMLInputElement;
  let mockPasswordInput: HTMLInputElement;
  let mockEmailError: HTMLElement;
  let mockPasswordError: HTMLElement;
  let mockGeneralError: HTMLElement;

  beforeEach(() => {
    // Create mock DOM elements
    mockForm = document.createElement('form');
    mockForm.id = 'test-form';
    
    mockEmailInput = document.createElement('input');
    mockEmailInput.id = 'email';
    mockEmailInput.type = 'email';
    
    mockPasswordInput = document.createElement('input');
    mockPasswordInput.id = 'password';
    mockPasswordInput.type = 'password';
    
    mockEmailError = document.createElement('div');
    mockEmailError.id = 'email-error';
    
    mockPasswordError = document.createElement('div');
    mockPasswordError.id = 'password-error';
    
    mockGeneralError = document.createElement('div');
    mockGeneralError.id = 'login-error';
    
    mockForm.appendChild(mockEmailInput);
    mockForm.appendChild(mockPasswordInput);
    mockForm.appendChild(mockEmailError);
    mockForm.appendChild(mockPasswordError);
    mockForm.appendChild(mockGeneralError);
    
    document.body.appendChild(mockForm);
    
    validator = new LoginFormValidator('test-form');
  });

  afterEach(() => {
    document.body.removeChild(mockForm);
  });

  describe('form validation', () => {
    it('should validate form with valid data', () => {
      mockEmailInput.value = 'test@example.com';
      mockPasswordInput.value = 'password123';
      
      const result = validator.validateForm();
      
      expect(result.isValid).toBe(true);
      expect(mockEmailInput.classList.contains('error')).toBe(false);
      expect(mockPasswordInput.classList.contains('error')).toBe(false);
    });

    it('should show error for invalid email', () => {
      mockEmailInput.value = 'invalid-email';
      mockPasswordInput.value = 'password123';
      
      const result = validator.validateForm();
      
      expect(result.isValid).toBe(false);
      expect(mockEmailInput.classList.contains('error')).toBe(true);
      expect(mockEmailError.textContent).toBe('El correo electrónico no es válido');
    });

    it('should show error for short password', () => {
      mockEmailInput.value = 'test@example.com';
      mockPasswordInput.value = '123';
      
      const result = validator.validateForm();
      
      expect(result.isValid).toBe(false);
      expect(mockPasswordInput.classList.contains('error')).toBe(true);
      expect(mockPasswordError.textContent).toBe('La contraseña debe tener al menos 6 caracteres');
    });

    it('should show errors for multiple invalid fields', () => {
      mockEmailInput.value = '';
      mockPasswordInput.value = '';
      
      const result = validator.validateForm();
      
      expect(result.isValid).toBe(false);
      expect(mockEmailInput.classList.contains('error')).toBe(true);
      expect(mockPasswordInput.classList.contains('error')).toBe(true);
      expect(mockEmailError.textContent).toBe('El correo electrónico es requerido');
      expect(mockPasswordError.textContent).toBe('La contraseña es requerida');
    });
  });

  describe('form data', () => {
    it('should return correct form data', () => {
      mockEmailInput.value = 'test@example.com';
      mockPasswordInput.value = 'password123';
      
      const formData = validator.getFormData();
      
      expect(formData).toEqual({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should trim email whitespace', () => {
      mockEmailInput.value = '  test@example.com  ';
      mockPasswordInput.value = 'password123';
      
      const formData = validator.getFormData();
      
      expect(formData.email).toBe('test@example.com');
    });
  });

  describe('error handling', () => {
    it('should show general error', () => {
      validator.showGeneralError('Login failed');
      
      expect(mockGeneralError.textContent).toBe('Login failed');
      expect(mockGeneralError.getAttribute('aria-live')).toBe('assertive');
    });

    it('should clear general error', () => {
      validator.showGeneralError('Login failed');
      validator.clearGeneralError();
      
      expect(mockGeneralError.textContent).toBe('');
      expect(mockGeneralError.hasAttribute('aria-live')).toBe(false);
    });

    it('should clear all errors', () => {
      mockEmailInput.value = '';
      mockPasswordInput.value = '';
      validator.validateForm();
      validator.showGeneralError('Login failed');
      
      validator.clearAllErrors();
      
      expect(mockEmailInput.classList.contains('error')).toBe(false);
      expect(mockPasswordInput.classList.contains('error')).toBe(false);
      expect(mockEmailError.textContent).toBe('');
      expect(mockPasswordError.textContent).toBe('');
      expect(mockGeneralError.textContent).toBe('');
    });

    it('should reset form', () => {
      mockEmailInput.value = 'test@example.com';
      mockPasswordInput.value = 'password123';
      validator.showGeneralError('Login failed');
      
      validator.reset();
      
      expect(mockEmailInput.value).toBe('');
      expect(mockPasswordInput.value).toBe('');
      expect(mockGeneralError.textContent).toBe('');
    });
  });
});