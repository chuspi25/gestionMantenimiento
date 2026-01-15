import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskList } from '../../src/frontend/scripts/taskList.js';
import { TaskDetail } from '../../src/frontend/scripts/taskDetail.js';
import { TaskForm } from '../../src/frontend/scripts/taskForm.js';
import { TaskProgress } from '../../src/frontend/scripts/taskProgress.js';
import { Task } from '../../src/frontend/scripts/types.js';

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

// Mock authManager
const mockAuthManager = {
  getToken: vi.fn(() => 'mock-token'),
  getCurrentUser: vi.fn(() => ({ id: '1', name: 'Test User', role: 'operator' })),
  isAuthenticated: vi.fn(() => true),
};

// Mock main.js authManager export
vi.mock('../../src/frontend/scripts/main.js', () => ({
  authManager: mockAuthManager,
}));

// Sample task data
const mockTask: Task = {
  id: '1',
  title: 'Test Task',
  description: 'Test Description',
  type: 'electrical',
  priority: 'high',
  status: 'pending',
  location: 'Test Location',
  estimatedDuration: 60,
  dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  createdAt: new Date().toISOString(),
  assignedTo: '1',
  requiredTools: ['Tool 1', 'Tool 2'],
  notes: [],
  attachments: [],
};

describe('TaskList Component', () => {
  let container: HTMLElement;
  let taskList: TaskList;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.id = 'task-list-container';
    document.body.appendChild(container);

    // Mock successful API response
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [mockTask] }),
    });

    taskList = new TaskList('task-list-container');
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create TaskList with valid container', () => {
      expect(taskList).toBeDefined();
      expect(container.querySelector('.task-list-component')).toBeTruthy();
    });

    it('should throw error with invalid container', () => {
      expect(() => new TaskList('non-existent')).toThrow('Container with id "non-existent" not found');
    });

    it('should render search and filter controls', () => {
      expect(container.querySelector('#task-search')).toBeTruthy();
      expect(container.querySelector('#filter-type')).toBeTruthy();
      expect(container.querySelector('#filter-status')).toBeTruthy();
      expect(container.querySelector('#filter-priority')).toBeTruthy();
    });
  });

  describe('task loading', () => {
    it('should load tasks from API', async () => {
      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(fetch).toHaveBeenCalledWith('/api/tasks', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle API errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const errorTaskList = new TaskList('task-list-container');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(container.querySelector('.task-list-error')).toBeTruthy();
    });
  });

  describe('filtering and sorting', () => {
    it('should filter tasks by search term', async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const searchInput = container.querySelector('#task-search') as HTMLInputElement;
      searchInput.value = 'Test';
      searchInput.dispatchEvent(new Event('input'));
      
      const filteredTasks = taskList.getFilteredTasks();
      expect(filteredTasks).toHaveLength(1);
    });

    it('should filter tasks by type', async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const typeFilter = container.querySelector('#filter-type') as HTMLSelectElement;
      typeFilter.value = 'electrical';
      typeFilter.dispatchEvent(new Event('change'));
      
      const filteredTasks = taskList.getFilteredTasks();
      expect(filteredTasks).toHaveLength(1);
    });

    it('should clear all filters', async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const clearButton = container.querySelector('#clear-filters') as HTMLButtonElement;
      clearButton.click();
      
      const searchInput = container.querySelector('#task-search') as HTMLInputElement;
      expect(searchInput.value).toBe('');
    });
  });

  describe('view switching', () => {
    it('should switch between grid and list views', () => {
      const gridButton = container.querySelector('#view-grid') as HTMLButtonElement;
      const listButton = container.querySelector('#view-list') as HTMLButtonElement;
      const content = container.querySelector('#task-list-content') as HTMLElement;
      
      listButton.click();
      expect(content.className).toContain('view-list');
      expect(listButton.classList.contains('active')).toBe(true);
      
      gridButton.click();
      expect(content.className).toContain('view-grid');
      expect(gridButton.classList.contains('active')).toBe(true);
    });
  });
});

describe('TaskDetail Component', () => {
  let container: HTMLElement;
  let taskDetail: TaskDetail;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'task-detail-container';
    document.body.appendChild(container);

    taskDetail = new TaskDetail('task-detail-container');
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create TaskDetail with valid container', () => {
      expect(taskDetail).toBeDefined();
      expect(container.querySelector('.task-detail-component')).toBeTruthy();
    });

    it('should render header with action buttons', () => {
      expect(container.querySelector('#back-button')).toBeTruthy();
      expect(container.querySelector('#edit-task-button')).toBeTruthy();
      expect(container.querySelector('#change-status-button')).toBeTruthy();
    });
  });

  describe('task loading', () => {
    it('should load task from API', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task: mockTask }),
      });

      await taskDetail.loadTask('1');
      
      expect(fetch).toHaveBeenCalledWith('/api/tasks/1', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should show task directly without API call', () => {
      taskDetail.showTask(mockTask);
      
      expect(container.querySelector('.task-detail-title')?.textContent).toBe('Test Task');
      expect(container.querySelector('.task-description')?.textContent).toBe('Test Description');
    });

    it('should handle API errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Not found'));
      
      await taskDetail.loadTask('999');
      
      expect(container.querySelector('.task-detail-error')).toBeTruthy();
    });
  });

  describe('task display', () => {
    beforeEach(() => {
      taskDetail.showTask(mockTask);
    });

    it('should display task information correctly', () => {
      expect(container.querySelector('.task-detail-title')?.textContent).toBe('Test Task');
      expect(container.querySelector('.priority-badge')?.textContent).toBe('Alta');
      expect(container.querySelector('.status-badge')?.textContent).toBe('Pendiente');
      expect(container.querySelector('.type-badge')?.textContent).toBe('Eléctrico');
    });

    it('should display required tools', () => {
      const toolItems = container.querySelectorAll('.tool-item');
      expect(toolItems).toHaveLength(2);
      expect(toolItems[0].textContent).toContain('Tool 1');
      expect(toolItems[1].textContent).toContain('Tool 2');
    });

    it('should show progress bar', () => {
      expect(container.querySelector('.progress-bar')).toBeTruthy();
      expect(container.querySelector('.progress-fill')).toBeTruthy();
    });
  });
});

describe('TaskForm Component', () => {
  let container: HTMLElement;
  let taskForm: TaskForm;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'task-form-container';
    document.body.appendChild(container);

    taskForm = new TaskForm('task-form-container');
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create TaskForm with valid container', () => {
      expect(taskForm).toBeDefined();
      expect(container.querySelector('.task-form-component')).toBeTruthy();
    });

    it('should render form fields', () => {
      expect(container.querySelector('#task-title')).toBeTruthy();
      expect(container.querySelector('#task-description')).toBeTruthy();
      expect(container.querySelector('#task-type')).toBeTruthy();
      expect(container.querySelector('#task-priority')).toBeTruthy();
      expect(container.querySelector('#task-location')).toBeTruthy();
    });

    it('should start in create mode', () => {
      expect(taskForm.getMode()).toBe('create');
      expect(container.querySelector('.form-title')?.textContent).toBe('Crear Nueva Tarea');
    });
  });

  describe('form validation', () => {
    it('should validate required fields', () => {
      const form = container.querySelector('#task-form') as HTMLFormElement;
      const titleInput = container.querySelector('#task-title') as HTMLInputElement;
      
      // Submit empty form
      form.dispatchEvent(new Event('submit'));
      
      expect(titleInput.classList.contains('error')).toBe(true);
    });

    it('should validate field lengths', () => {
      const titleInput = container.querySelector('#task-title') as HTMLInputElement;
      titleInput.value = 'a'.repeat(101); // Exceed max length
      titleInput.dispatchEvent(new Event('blur'));
      
      expect(container.querySelector('#title-error')?.textContent).toContain('100 caracteres');
    });

    it('should validate due date is in future', () => {
      const dueDateInput = container.querySelector('#task-due-date') as HTMLInputElement;
      const yesterday = new Date(Date.now() - 86400000);
      dueDateInput.value = yesterday.toISOString().slice(0, 16);
      dueDateInput.dispatchEvent(new Event('change'));
      
      expect(container.querySelector('#dueDate-error')?.textContent).toContain('futuro');
    });
  });

  describe('tools management', () => {
    it('should add tools to list', () => {
      const toolsInput = container.querySelector('#task-tools-input') as HTMLInputElement;
      const addButton = container.querySelector('#add-tool-button') as HTMLButtonElement;
      
      toolsInput.value = 'Test Tool';
      addButton.click();
      
      expect(container.querySelector('.tool-item')).toBeTruthy();
      expect(container.querySelector('.tool-name')?.textContent).toBe('Test Tool');
      expect(toolsInput.value).toBe('');
    });

    it('should prevent duplicate tools', () => {
      const toolsInput = container.querySelector('#task-tools-input') as HTMLInputElement;
      const addButton = container.querySelector('#add-tool-button') as HTMLButtonElement;
      
      // Add same tool twice
      toolsInput.value = 'Test Tool';
      addButton.click();
      toolsInput.value = 'Test Tool';
      addButton.click();
      
      expect(container.querySelectorAll('.tool-item')).toHaveLength(1);
    });
  });

  describe('mode switching', () => {
    it('should switch to edit mode', () => {
      taskForm.setEditMode(mockTask);
      
      expect(taskForm.getMode()).toBe('edit');
      expect(container.querySelector('.form-title')?.textContent).toBe('Editar Tarea');
      
      const titleInput = container.querySelector('#task-title') as HTMLInputElement;
      expect(titleInput.value).toBe('Test Task');
    });

    it('should populate form in edit mode', () => {
      taskForm.setEditMode(mockTask);
      
      const descriptionInput = container.querySelector('#task-description') as HTMLTextAreaElement;
      const typeSelect = container.querySelector('#task-type') as HTMLSelectElement;
      const prioritySelect = container.querySelector('#task-priority') as HTMLSelectElement;
      
      expect(descriptionInput.value).toBe('Test Description');
      expect(typeSelect.value).toBe('electrical');
      expect(prioritySelect.value).toBe('high');
    });
  });

  describe('form submission', () => {
    it('should submit valid form data', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task: mockTask }),
      });

      // Fill form with valid data
      const titleInput = container.querySelector('#task-title') as HTMLInputElement;
      const descriptionInput = container.querySelector('#task-description') as HTMLTextAreaElement;
      const typeSelect = container.querySelector('#task-type') as HTMLSelectElement;
      const prioritySelect = container.querySelector('#task-priority') as HTMLSelectElement;
      const locationInput = container.querySelector('#task-location') as HTMLInputElement;
      const durationInput = container.querySelector('#task-estimated-duration') as HTMLInputElement;
      const dueDateInput = container.querySelector('#task-due-date') as HTMLInputElement;

      titleInput.value = 'Test Task';
      descriptionInput.value = 'Test Description';
      typeSelect.value = 'electrical';
      prioritySelect.value = 'high';
      locationInput.value = 'Test Location';
      durationInput.value = '60';
      dueDateInput.value = new Date(Date.now() + 86400000).toISOString().slice(0, 16);

      const form = container.querySelector('#task-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        })
      }));
    });
  });
});

describe('TaskProgress Component', () => {
  let container: HTMLElement;
  let taskProgress: TaskProgress;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'task-progress-container';
    document.body.appendChild(container);

    taskProgress = new TaskProgress('task-progress-container');
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create TaskProgress with valid container', () => {
      expect(taskProgress).toBeDefined();
    });

    it('should be hidden initially', () => {
      expect(container.style.display).toBe('none');
    });
  });

  describe('showing task progress', () => {
    beforeEach(() => {
      taskProgress.show(mockTask);
    });

    it('should show modal when task is provided', () => {
      expect(container.style.display).toBe('block');
      expect(container.querySelector('.task-progress-modal')).toBeTruthy();
    });

    it('should display task information', () => {
      expect(container.querySelector('h3')?.textContent).toBe('Test Task');
      expect(container.querySelector('.task-location')?.textContent).toContain('Test Location');
    });

    it('should render status update section', () => {
      expect(container.querySelector('#new-status')).toBeTruthy();
      expect(container.querySelector('#status-note')).toBeTruthy();
      expect(container.querySelector('#update-status-btn')).toBeTruthy();
    });

    it('should render add note section', () => {
      expect(container.querySelector('#note-content')).toBeTruthy();
      expect(container.querySelector('#add-note-btn')).toBeTruthy();
    });

    it('should render file upload section', () => {
      expect(container.querySelector('#file-input')).toBeTruthy();
      expect(container.querySelector('#upload-file-btn')).toBeTruthy();
    });
  });

  describe('status updates', () => {
    beforeEach(() => {
      taskProgress.show(mockTask);
    });

    it('should show appropriate status options', () => {
      const statusSelect = container.querySelector('#new-status') as HTMLSelectElement;
      const options = Array.from(statusSelect.options).map(opt => opt.value);
      
      // For pending status, should allow pending, in_progress, cancelled
      expect(options).toContain('pending');
      expect(options).toContain('in_progress');
      expect(options).toContain('cancelled');
    });

    it('should handle status update', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTask, status: 'in_progress' }),
      });

      const statusSelect = container.querySelector('#new-status') as HTMLSelectElement;
      const updateButton = container.querySelector('#update-status-btn') as HTMLButtonElement;

      statusSelect.value = 'in_progress';
      updateButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith('/api/tasks/1/status', expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer null' // localStorage mock returns null
        })
      }));
    });
  });

  describe('note addition', () => {
    beforeEach(() => {
      taskProgress.show(mockTask);
    });

    it('should validate note content', async () => {
      const addNoteButton = container.querySelector('#add-note-btn') as HTMLButtonElement;
      addNoteButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(container.querySelector('.error-message')).toBeTruthy();
    });

    it('should add note with valid content', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', content: 'Test note', createdAt: new Date().toISOString() }),
      });

      const noteTextarea = container.querySelector('#note-content') as HTMLTextAreaElement;
      const addNoteButton = container.querySelector('#add-note-btn') as HTMLButtonElement;

      noteTextarea.value = 'Test note';
      addNoteButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith('/api/tasks/1/notes', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('file upload', () => {
    beforeEach(() => {
      taskProgress.show(mockTask);
    });

    it('should enable upload button when file is selected', () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      const uploadButton = container.querySelector('#upload-file-btn') as HTMLButtonElement;

      expect(uploadButton.disabled).toBe(true);

      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [new File(['test'], 'test.txt', { type: 'text/plain' })],
        writable: false,
      });
      fileInput.dispatchEvent(new Event('change'));

      expect(uploadButton.disabled).toBe(false);
    });

    it('should validate file size', async () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      const uploadButton = container.querySelector('#upload-file-btn') as HTMLButtonElement;

      // Create large file (>10MB)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      });
      fileInput.dispatchEvent(new Event('change'));
      uploadButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(container.querySelector('.error-message')).toBeTruthy();
    });
  });

  describe('modal interactions', () => {
    beforeEach(() => {
      taskProgress.show(mockTask);
    });

    it('should hide modal when close button is clicked', () => {
      const closeButton = container.querySelector('#close-progress') as HTMLButtonElement;
      closeButton.click();

      expect(container.style.display).toBe('none');
    });

    it('should hide modal when cancel button is clicked', () => {
      const cancelButton = container.querySelector('#cancel-progress') as HTMLButtonElement;
      cancelButton.click();

      expect(container.style.display).toBe('none');
    });

    it('should hide modal when clicking outside', () => {
      container.click();

      expect(container.style.display).toBe('none');
    });
  });
});