import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoleGuard, RoleGuardUI, APP_ROUTES } from '../../src/frontend/scripts/roleGuard.js';
import { AuthManager } from '../../src/frontend/scripts/auth.js';
import { User } from '../../src/frontend/scripts/types.js';

// Mock AuthManager
const mockAuthManager = {
  isAuthenticated: vi.fn(),
  getCurrentUser: vi.fn(),
} as any;

// Mock window methods
Object.defineProperty(window, 'location', {
  value: {
    hash: '',
  },
  writable: true,
});

Object.defineProperty(window, 'addEventListener', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

describe('RoleGuard', () => {
  let roleGuard: RoleGuard;
  
  const mockOperator: User = {
    id: '1',
    email: 'operator@example.com',
    name: 'Test Operator',
    role: 'operator',
    isActive: true,
    createdAt: new Date(),
  };

  const mockSupervisor: User = {
    id: '2',
    email: 'supervisor@example.com',
    name: 'Test Supervisor',
    role: 'supervisor',
    isActive: true,
    createdAt: new Date(),
  };

  const mockAdmin: User = {
    id: '3',
    email: 'admin@example.com',
    name: 'Test Admin',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthManager.isAuthenticated.mockReturnValue(true);
    roleGuard = new RoleGuard(mockAuthManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('permissions', () => {
    it('should return correct permissions for operator', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const permissions = roleGuard.getCurrentUserPermissions();
      
      expect(permissions).toBeDefined();
      expect(permissions!.canViewDashboard).toBe(true);
      expect(permissions!.canViewTasks).toBe(true);
      expect(permissions!.canCreateTasks).toBe(false);
      expect(permissions!.canViewUsers).toBe(false);
      expect(permissions!.canViewReports).toBe(false);
      expect(permissions!.canViewSystemSettings).toBe(false);
    });

    it('should return correct permissions for supervisor', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      const permissions = roleGuard.getCurrentUserPermissions();
      
      expect(permissions).toBeDefined();
      expect(permissions!.canViewDashboard).toBe(true);
      expect(permissions!.canViewTasks).toBe(true);
      expect(permissions!.canCreateTasks).toBe(true);
      expect(permissions!.canViewUsers).toBe(true);
      expect(permissions!.canViewReports).toBe(true);
      expect(permissions!.canCreateUsers).toBe(false);
      expect(permissions!.canViewSystemSettings).toBe(false);
    });

    it('should return correct permissions for admin', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      const permissions = roleGuard.getCurrentUserPermissions();
      
      expect(permissions).toBeDefined();
      expect(permissions!.canViewDashboard).toBe(true);
      expect(permissions!.canViewTasks).toBe(true);
      expect(permissions!.canCreateTasks).toBe(true);
      expect(permissions!.canViewUsers).toBe(true);
      expect(permissions!.canViewReports).toBe(true);
      expect(permissions!.canCreateUsers).toBe(true);
      expect(permissions!.canViewSystemSettings).toBe(true);
    });

    it('should return null permissions when no user is authenticated', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(null);
      
      const permissions = roleGuard.getCurrentUserPermissions();
      
      expect(permissions).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.hasPermission('canCreateTasks')).toBe(true);
      expect(roleGuard.hasPermission('canViewReports')).toBe(true);
    });

    it('should return false when user does not have permission', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.hasPermission('canCreateTasks')).toBe(false);
      expect(roleGuard.hasPermission('canViewReports')).toBe(false);
    });

    it('should return false when no user is authenticated', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(null);
      
      expect(roleGuard.hasPermission('canViewDashboard')).toBe(false);
    });
  });

  describe('canAccessRoute', () => {
    it('should allow access to dashboard for all authenticated users', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canAccessRoute('/dashboard')).toBe(true);
    });

    it('should allow access to tasks for all authenticated users', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canAccessRoute('/tasks')).toBe(true);
    });

    it('should deny access to task creation for operators', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canAccessRoute('/tasks/create')).toBe(false);
    });

    it('should allow access to task creation for supervisors', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canAccessRoute('/tasks/create')).toBe(true);
    });

    it('should deny access to users for operators', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canAccessRoute('/users')).toBe(false);
    });

    it('should allow access to users for supervisors', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canAccessRoute('/users')).toBe(true);
    });

    it('should deny access to user creation for supervisors', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canAccessRoute('/users/create')).toBe(false);
    });

    it('should allow access to user creation for admins', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      expect(roleGuard.canAccessRoute('/users/create')).toBe(true);
    });

    it('should deny access to reports for operators', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canAccessRoute('/reports')).toBe(false);
    });

    it('should allow access to reports for supervisors', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canAccessRoute('/reports')).toBe(true);
    });

    it('should deny access to settings for operators and supervisors', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      expect(roleGuard.canAccessRoute('/settings')).toBe(false);
      
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      expect(roleGuard.canAccessRoute('/settings')).toBe(false);
    });

    it('should allow access to settings for admins', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      expect(roleGuard.canAccessRoute('/settings')).toBe(true);
    });

    it('should return false for non-existent routes', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      expect(roleGuard.canAccessRoute('/non-existent')).toBe(false);
    });
  });

  describe('getAccessibleRoutes', () => {
    it('should return correct routes for operator', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const routes = roleGuard.getAccessibleRoutes();
      const routePaths = routes.map(r => r.path);
      
      expect(routePaths).toContain('/dashboard');
      expect(routePaths).toContain('/tasks');
      expect(routePaths).not.toContain('/tasks/create');
      expect(routePaths).not.toContain('/users');
      expect(routePaths).not.toContain('/reports');
      expect(routePaths).not.toContain('/settings');
    });

    it('should return correct routes for supervisor', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      const routes = roleGuard.getAccessibleRoutes();
      const routePaths = routes.map(r => r.path);
      
      expect(routePaths).toContain('/dashboard');
      expect(routePaths).toContain('/tasks');
      expect(routePaths).toContain('/tasks/create');
      expect(routePaths).toContain('/users');
      expect(routePaths).toContain('/reports');
      expect(routePaths).not.toContain('/users/create');
      expect(routePaths).not.toContain('/settings');
    });

    it('should return all routes for admin', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      const routes = roleGuard.getAccessibleRoutes();
      const routePaths = routes.map(r => r.path);
      
      expect(routePaths).toContain('/dashboard');
      expect(routePaths).toContain('/tasks');
      expect(routePaths).toContain('/tasks/create');
      expect(routePaths).toContain('/users');
      expect(routePaths).toContain('/users/create');
      expect(routePaths).toContain('/reports');
      expect(routePaths).toContain('/settings');
    });
  });

  describe('navigateToRoute', () => {
    it('should navigate to accessible route', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      const result = roleGuard.navigateToRoute('/tasks');
      
      expect(result).toBe(true);
      expect(roleGuard.getCurrentRoute()).toBe('/tasks');
    });

    it('should deny navigation to inaccessible route', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const result = roleGuard.navigateToRoute('/users');
      
      expect(result).toBe(false);
      expect(roleGuard.getCurrentRoute()).toBe('/dashboard'); // Should redirect to dashboard
    });

    it('should use fallback route when specified', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const result = roleGuard.navigateToRoute('/tasks/create');
      
      expect(result).toBe(false);
      // Should redirect to fallback route (/tasks) if accessible
      expect(roleGuard.getCurrentRoute()).toBe('/tasks');
    });

    it('should deny navigation when not authenticated', () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      
      const result = roleGuard.navigateToRoute('/dashboard');
      
      expect(result).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    it('should allow action when user has permission', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canPerformAction('canCreateTasks')).toBe(true);
    });

    it('should deny action when user does not have permission', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canPerformAction('canCreateTasks')).toBe(false);
    });

    it('should allow operator to edit their own tasks', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canPerformAction('canEditTasks', mockOperator.id)).toBe(true);
    });

    it('should deny operator to edit other users tasks', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.canPerformAction('canEditTasks', 'other-user-id')).toBe(false);
    });

    it('should allow supervisor to edit any tasks', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      
      expect(roleGuard.canPerformAction('canEditTasks', 'any-user-id')).toBe(true);
    });
  });

  describe('generateNavigation', () => {
    it('should generate navigation with accessible routes only', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const navigation = roleGuard.generateNavigation();
      const routePaths = navigation.map(item => item.route.path);
      
      expect(routePaths).toContain('/dashboard');
      expect(routePaths).toContain('/tasks');
      expect(routePaths).not.toContain('/users');
      expect(routePaths).not.toContain('/reports');
      expect(routePaths).not.toContain('/settings');
    });

    it('should mark current route as active', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      roleGuard.navigateToRoute('/tasks');
      
      const navigation = roleGuard.generateNavigation();
      const tasksItem = navigation.find(item => item.route.path === '/tasks');
      const dashboardItem = navigation.find(item => item.route.path === '/dashboard');
      
      expect(tasksItem?.isActive).toBe(true);
      expect(dashboardItem?.isActive).toBe(false);
    });

    it('should exclude create routes from main navigation', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockAdmin);
      
      const navigation = roleGuard.generateNavigation();
      const routePaths = navigation.map(item => item.route.path);
      
      expect(routePaths).not.toContain('/tasks/create');
      expect(routePaths).not.toContain('/users/create');
    });
  });

  describe('getRestrictionMessage', () => {
    it('should return appropriate message for each permission', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      expect(roleGuard.getRestrictionMessage('canCreateTasks'))
        .toBe('No tienes permisos para crear tareas');
      expect(roleGuard.getRestrictionMessage('canViewReports'))
        .toBe('No tienes permisos para ver reportes');
      expect(roleGuard.getRestrictionMessage('canViewUsers'))
        .toBe('No tienes permisos para ver usuarios');
    });

    it('should return login message when not authenticated', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(null);
      
      expect(roleGuard.getRestrictionMessage('canViewDashboard'))
        .toBe('Debes iniciar sesión para realizar esta acción');
    });
  });

  describe('clearState', () => {
    it('should reset to initial state', () => {
      mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
      roleGuard.navigateToRoute('/tasks');
      
      roleGuard.clearState();
      
      expect(roleGuard.getCurrentRoute()).toBe('/dashboard');
    });
  });
});

describe('RoleGuardUI', () => {
  let roleGuard: RoleGuard;
  let roleGuardUI: RoleGuardUI;
  let mockContainer: HTMLElement;

  const mockSupervisor: User = {
    id: '2',
    email: 'supervisor@example.com',
    name: 'Test Supervisor',
    role: 'supervisor',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthManager.isAuthenticated.mockReturnValue(true);
    mockAuthManager.getCurrentUser.mockReturnValue(mockSupervisor);
    
    roleGuard = new RoleGuard(mockAuthManager);
    roleGuardUI = new RoleGuardUI(roleGuard);
    
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-navigation';
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (document.body.contains(mockContainer)) {
      document.body.removeChild(mockContainer);
    }
  });

  describe('generateNavigationMenu', () => {
    it('should generate navigation menu HTML', () => {
      roleGuardUI.generateNavigationMenu('test-navigation');
      
      const links = mockContainer.querySelectorAll('.nav-link');
      expect(links.length).toBeGreaterThan(0);
      
      const dashboardLink = Array.from(links).find(link => 
        link.getAttribute('href') === '#/dashboard'
      );
      expect(dashboardLink).toBeDefined();
      expect(dashboardLink?.textContent?.trim()).toBe('Dashboard');
    });

    it('should mark active route', () => {
      roleGuard.navigateToRoute('/tasks');
      roleGuardUI.generateNavigationMenu('test-navigation');
      
      const tasksLink = Array.from(mockContainer.querySelectorAll('.nav-link')).find(link => 
        link.getAttribute('href') === '#/tasks'
      );
      
      expect(tasksLink?.classList.contains('active')).toBe(true);
    });

    it('should handle non-existent container gracefully', () => {
      expect(() => {
        roleGuardUI.generateNavigationMenu('non-existent');
      }).not.toThrow();
    });
  });

  describe('applyAccessControl', () => {
    it('should hide elements without permission', () => {
      const protectedElement = document.createElement('div');
      protectedElement.setAttribute('data-permission', 'canCreateUsers');
      protectedElement.textContent = 'Create User';
      document.body.appendChild(protectedElement);
      
      roleGuardUI.applyAccessControl();
      
      expect(protectedElement.style.display).toBe('none');
      expect(protectedElement.classList.contains('access-denied')).toBe(true);
      
      document.body.removeChild(protectedElement);
    });

    it('should show elements with permission', () => {
      const protectedElement = document.createElement('div');
      protectedElement.setAttribute('data-permission', 'canViewTasks');
      protectedElement.textContent = 'View Tasks';
      document.body.appendChild(protectedElement);
      
      roleGuardUI.applyAccessControl();
      
      expect(protectedElement.style.display).toBe('');
      expect(protectedElement.classList.contains('access-denied')).toBe(false);
      
      document.body.removeChild(protectedElement);
    });

    it('should show restriction message when requested', () => {
      const protectedElement = document.createElement('div');
      protectedElement.setAttribute('data-permission', 'canCreateUsers');
      protectedElement.setAttribute('data-show-restriction', 'true');
      protectedElement.textContent = 'Create User';
      document.body.appendChild(protectedElement);
      
      roleGuardUI.applyAccessControl();
      
      const messageElement = protectedElement.querySelector('.restriction-message');
      expect(messageElement).toBeDefined();
      expect(messageElement?.textContent).toContain('No tienes permisos');
      
      document.body.removeChild(protectedElement);
    });

    it('should handle resource ownership', () => {
      // Mock operator user
      const mockOperator: User = {
        id: '1',
        email: 'operator@example.com',
        name: 'Test Operator',
        role: 'operator',
        isActive: true,
        createdAt: new Date(),
      };
      mockAuthManager.getCurrentUser.mockReturnValue(mockOperator);
      
      const ownElement = document.createElement('div');
      ownElement.setAttribute('data-permission', 'canEditTasks');
      ownElement.setAttribute('data-resource-owner', '1'); // Same as user ID
      document.body.appendChild(ownElement);
      
      const otherElement = document.createElement('div');
      otherElement.setAttribute('data-permission', 'canEditTasks');
      otherElement.setAttribute('data-resource-owner', '2'); // Different user ID
      document.body.appendChild(otherElement);
      
      roleGuardUI.applyAccessControl();
      
      expect(ownElement.style.display).toBe(''); // Should be visible
      expect(otherElement.style.display).toBe('none'); // Should be hidden
      
      document.body.removeChild(ownElement);
      document.body.removeChild(otherElement);
    });
  });
});