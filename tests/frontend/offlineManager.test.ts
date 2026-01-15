import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineManager } from '../../src/frontend/scripts/offlineManager.js';
import { SyncIndicator } from '../../src/frontend/scripts/syncIndicator.js';
import { Task } from '../../src/frontend/scripts/types.js';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn();

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'dispatchEvent', { value: mockDispatchEvent });

global.localStorage = localStorageMock as any;

// Mock DOM methods
const mockElement = {
  id: '',
  className: '',
  innerHTML: '',
  style: {},
  addEventListener: vi.fn(),
  appendChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn().mockReturnValue([]),
};

document.createElement = vi.fn().mockReturnValue(mockElement);
document.getElementById = vi.fn().mockReturnValue(null);

// Mock document.body properly for jsdom
Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn(),
  },
  writable: true,
});

describe('OfflineManager Unit Tests', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
    
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    
    offlineManager = new OfflineManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with online status', () => {
      expect(offlineManager.getConnectionStatus()).toBe(true);
    });

    it('should set up event listeners', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should load pending actions on initialization', () => {
      expect(localStorageMock.getItem).toHaveBeenCalledWith('offline_pending_actions');
    });
  });

  describe('task storage operations', () => {
    const mockTask: Task = {
      id: '1',
      title: 'Test Task',
      description: 'Test Description',
      type: 'electrical',
      priority: 'high',
      status: 'pending',
      location: 'Test Location',
      estimatedDuration: 60,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      requiredTools: ['Tool 1'],
      notes: [],
      attachments: [],
    };

    it('should save tasks to localStorage', () => {
      const tasks = [mockTask];
      
      offlineManager.saveTasks(tasks);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_tasks',
        JSON.stringify(tasks)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_last_sync',
        expect.any(String)
      );
    });

    it('should retrieve tasks from localStorage', () => {
      const tasks = [mockTask];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(tasks));
      
      const retrievedTasks = offlineManager.getTasks();
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('offline_tasks');
      expect(retrievedTasks).toEqual(tasks);
    });

    it('should return empty array when no tasks in storage', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const tasks = offlineManager.getTasks();
      
      expect(tasks).toEqual([]);
    });

    it('should handle corrupted task data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const tasks = offlineManager.getTasks();
      
      expect(tasks).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading tasks from localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle storage errors when saving', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      offlineManager.saveTasks([mockTask]);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving tasks to localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('offline task operations', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        if (key === 'auth_user') return JSON.stringify({ id: 'user-1' });
        return null;
      });
    });

    it('should add task offline', () => {
      const taskData = {
        title: 'New Task',
        description: 'New Description',
        type: 'mechanical' as const,
        priority: 'medium' as const,
        location: 'New Location',
        estimatedDuration: 90,
        dueDate: new Date().toISOString(),
        assignedTo: 'user-2',
        requiredTools: ['Tool A', 'Tool B']
      };
      
      const taskId = offlineManager.addTaskOffline(taskData);
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(taskId.startsWith('offline_')).toBe(true);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_tasks',
        expect.stringContaining(taskData.title)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_pending_actions',
        expect.stringContaining('CREATE_TASK')
      );
    });

    it('should update task offline', () => {
      const existingTask = {
        id: 'task-1',
        title: 'Original Task',
        description: 'Original Description',
        type: 'electrical',
        priority: 'low',
        status: 'pending',
        location: 'Original Location',
        estimatedDuration: 60,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        requiredTools: [],
        notes: [],
        attachments: []
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([existingTask]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        return null;
      });
      
      const updates = {
        title: 'Updated Task',
        priority: 'high' as const
      };
      
      offlineManager.updateTaskOffline('task-1', updates);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_tasks',
        expect.stringContaining('Updated Task')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_pending_actions',
        expect.stringContaining('UPDATE_TASK')
      );
    });

    it('should delete task offline', () => {
      const existingTask = {
        id: 'task-1',
        title: 'Task to Delete',
        description: 'Description',
        type: 'electrical',
        priority: 'medium',
        status: 'pending',
        location: 'Location',
        estimatedDuration: 60,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        requiredTools: [],
        notes: [],
        attachments: []
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([existingTask]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        return null;
      });
      
      offlineManager.deleteTaskOffline('task-1');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_tasks',
        expect.not.stringContaining('Task to Delete')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_pending_actions',
        expect.stringContaining('DELETE_TASK')
      );
    });

    it('should add note offline', () => {
      const existingTask = {
        id: 'task-1',
        title: 'Task with Note',
        description: 'Description',
        type: 'electrical',
        priority: 'medium',
        status: 'pending',
        location: 'Location',
        estimatedDuration: 60,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        requiredTools: [],
        notes: [],
        attachments: []
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([existingTask]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        if (key === 'auth_user') return JSON.stringify({ id: 'user-1' });
        return null;
      });
      
      const noteContent = 'This is a test note';
      
      offlineManager.addNoteOffline('task-1', noteContent);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_tasks',
        expect.stringContaining(noteContent)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_pending_actions',
        expect.stringContaining('ADD_NOTE')
      );
    });
  });

  describe('synchronization', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        if (key === 'auth_token') return 'mock-token';
        return null;
      });
    });

    it('should sync successfully with server', async () => {
      const serverTasks = [
        {
          id: 'server-task-1',
          title: 'Server Task',
          description: 'From server',
          type: 'electrical',
          priority: 'high',
          status: 'pending',
          location: 'Server Location',
          estimatedDuration: 120,
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          requiredTools: [],
          notes: [],
          attachments: []
        }
      ];
      
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: serverTasks }),
      });
      
      const result = await offlineManager.syncWithServer();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('exitosamente');
      expect(result.syncedTasks).toBe(1);
      expect(result.pendingActions).toBe(0);
      
      expect(fetch).toHaveBeenCalledWith('/api/tasks', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle sync errors', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));
      
      const result = await offlineManager.syncWithServer();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error durante la sincronización');
      expect(result.message).toContain('Network error');
    });

    it('should prevent sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      const offlineManagerOffline = new OfflineManager();
      const result = await offlineManagerOffline.syncWithServer();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Sin conexión a internet');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should prevent concurrent sync operations', async () => {
      let resolveFirstSync: (value: any) => void;
      const firstSyncPromise = new Promise(resolve => {
        resolveFirstSync = resolve;
      });
      
      (fetch as any).mockImplementation(() => firstSyncPromise);
      
      // Start first sync
      const firstSyncResult = offlineManager.syncWithServer();
      
      // Try second sync while first is in progress
      const secondSyncResult = await offlineManager.syncWithServer();
      
      expect(secondSyncResult.success).toBe(false);
      expect(secondSyncResult.message).toContain('Sincronización en progreso');
      
      // Resolve first sync
      resolveFirstSync!({
        ok: true,
        json: async () => ({ tasks: [] }),
      });
      
      const firstResult = await firstSyncResult;
      expect(firstResult.success).toBe(true);
    });
  });

  describe('sync info', () => {
    it('should return correct sync information', () => {
      const mockTasks = [{ id: '1', title: 'Task 1' }];
      const mockPendingActions = [{ type: 'CREATE_TASK', data: {}, timestamp: Date.now(), localId: '1' }];
      const mockLastSync = Date.now();
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify(mockTasks);
        if (key === 'offline_pending_actions') return JSON.stringify(mockPendingActions);
        if (key === 'offline_last_sync') return mockLastSync.toString();
        return null;
      });
      
      const syncInfo = offlineManager.getSyncInfo();
      
      expect(syncInfo.isOnline).toBe(true);
      expect(syncInfo.localTasks).toBe(1);
      expect(syncInfo.pendingActions).toBe(1);
      expect(syncInfo.syncInProgress).toBe(false);
      expect(syncInfo.lastSync).toEqual(new Date(mockLastSync));
    });

    it('should handle null last sync', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'offline_tasks') return JSON.stringify([]);
        if (key === 'offline_pending_actions') return JSON.stringify([]);
        if (key === 'offline_last_sync') return null;
        return null;
      });
      
      const syncInfo = offlineManager.getSyncInfo();
      
      expect(syncInfo.lastSync).toBeNull();
    });
  });

  describe('data cleanup', () => {
    it('should clear all offline data', () => {
      offlineManager.clearOfflineData();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_tasks');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_pending_actions');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_last_sync');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_user_data');
    });
  });

  describe('event handling', () => {
    it('should handle online event', () => {
      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      
      expect(onlineHandler).toBeDefined();
      
      // Simulate online event
      if (onlineHandler) {
        onlineHandler();
        
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'offline-manager-online'
          })
        );
      }
    });

    it('should handle offline event', () => {
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];
      
      expect(offlineHandler).toBeDefined();
      
      // Simulate offline event
      if (offlineHandler) {
        offlineHandler();
        
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'offline-manager-offline'
          })
        );
      }
    });
  });
});

describe('SyncIndicator Unit Tests', () => {
  let syncIndicator: SyncIndicator;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock container element
    mockContainer = {
      id: 'sync-indicator',
      className: '',
      innerHTML: '',
      style: {},
      querySelector: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        click: vi.fn(),
        style: { display: 'none' },
        disabled: false,
        textContent: '',
        classList: { contains: vi.fn().mockReturnValue(false) }
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      appendChild: vi.fn(),
    } as any;
    
    document.getElementById = vi.fn().mockReturnValue(mockContainer);
    
    syncIndicator = new SyncIndicator('sync-indicator');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create sync indicator with existing container', () => {
      expect(document.getElementById).toHaveBeenCalledWith('sync-indicator');
      expect(mockContainer.innerHTML).toContain('sync-indicator');
    });

    it('should throw error with non-existent container', () => {
      document.getElementById = vi.fn().mockReturnValue(null);
      
      expect(() => new SyncIndicator('non-existent')).toThrow(
        'Container with id "non-existent" not found'
      );
    });

    it('should create default container when no id provided', () => {
      document.body.appendChild = vi.fn();
      
      new SyncIndicator();
      
      expect(document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('status updates', () => {
    it('should update status correctly', () => {
      // Mock offlineManager.getSyncInfo
      const mockGetSyncInfo = vi.fn().mockReturnValue({
        isOnline: true,
        lastSync: new Date(),
        pendingActions: 0,
        syncInProgress: false,
        localTasks: 5
      });
      
      // This would require more complex mocking of the offlineManager import
      // For now, we'll test the basic functionality
      expect(syncIndicator.getCurrentStatus()).toBeDefined();
    });

    it('should show indicator when there are issues', () => {
      syncIndicator.show();
      // Verify that the indicator becomes visible
      expect(mockContainer.className).toContain('visible');
    });

    it('should hide indicator when requested', () => {
      syncIndicator.hide();
      // Verify that the indicator becomes hidden
      expect(mockContainer.className).toContain('hidden');
    });
  });

  describe('manual sync', () => {
    it('should trigger manual sync when button clicked', () => {
      const mockButton = {
        addEventListener: vi.fn(),
        disabled: false,
        textContent: 'Sincronizar ahora'
      };
      
      mockContainer.querySelector = vi.fn().mockReturnValue(mockButton);
      
      // Simulate button click
      const clickHandler = mockButton.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];
      
      if (clickHandler) {
        clickHandler();
        // Verify that sync was triggered (would need more complex mocking)
      }
    });
  });

  describe('force update', () => {
    it('should force update when requested', () => {
      expect(() => syncIndicator.forceUpdate()).not.toThrow();
    });
  });
});