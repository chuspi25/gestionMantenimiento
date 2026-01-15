import { Task, TaskNote } from './types.js';

/**
 * Gestor de funcionalidad offline para almacenamiento local y sincronización
 */
export class OfflineManager {
    private static readonly STORAGE_KEYS = {
        TASKS: 'offline_tasks',
        PENDING_ACTIONS: 'offline_pending_actions',
        LAST_SYNC: 'offline_last_sync',
        USER_DATA: 'offline_user_data'
    };

    private isOnline: boolean = navigator.onLine;
    private syncInProgress: boolean = false;
    private pendingActions: OfflineAction[] = [];

    constructor() {
        this.initialize();
    }

    /**
     * Inicializar el gestor offline
     */
    private initialize(): void {
        // Cargar acciones pendientes
        this.loadPendingActions();

        // Configurar listeners de conectividad
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // Intentar sincronizar si hay conexión
        if (this.isOnline && this.pendingActions.length > 0) {
            this.syncPendingActions();
        }
    }

    /**
     * Verificar si está online
     */
    public getConnectionStatus(): boolean {
        return this.isOnline;
    }

    /**
     * Obtener tareas desde localStorage
     */
    public getTasks(): Task[] {
        try {
            const tasksJson = localStorage.getItem(OfflineManager.STORAGE_KEYS.TASKS);
            return tasksJson ? JSON.parse(tasksJson) : [];
        } catch (error) {
            console.error('Error loading tasks from localStorage:', error);
            return [];
        }
    }

    /**
     * Guardar tareas en localStorage
     */
    public saveTasks(tasks: Task[]): void {
        try {
            localStorage.setItem(OfflineManager.STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            this.updateLastSync();
        } catch (error) {
            console.error('Error saving tasks to localStorage:', error);
        }
    }

    /**
     * Agregar tarea offline
     */
    public addTaskOffline(task: Omit<Task, 'id' | 'createdAt'>): string {
        const newTask: Task = {
            ...task,
            id: this.generateOfflineId(),
            createdAt: new Date(),
            notes: [],
            attachments: []
        };

        // Guardar tarea localmente
        const tasks = this.getTasks();
        tasks.push(newTask);
        this.saveTasks(tasks);

        // Agregar acción pendiente
        this.addPendingAction({
            type: 'CREATE_TASK',
            data: newTask,
            timestamp: Date.now(),
            localId: newTask.id
        });

        return newTask.id;
    }

    /**
     * Actualizar tarea offline
     */
    public updateTaskOffline(taskId: string, updates: Partial<Task>): void {
        const tasks = this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex !== -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
            this.saveTasks(tasks);

            // Agregar acción pendiente
            this.addPendingAction({
                type: 'UPDATE_TASK',
                data: { id: taskId, updates },
                timestamp: Date.now(),
                localId: taskId
            });
        }
    }

    /**
     * Eliminar tarea offline
     */
    public deleteTaskOffline(taskId: string): void {
        const tasks = this.getTasks();
        const filteredTasks = tasks.filter(t => t.id !== taskId);
        this.saveTasks(filteredTasks);

        // Agregar acción pendiente
        this.addPendingAction({
            type: 'DELETE_TASK',
            data: { id: taskId },
            timestamp: Date.now(),
            localId: taskId
        });
    }

    /**
     * Agregar nota offline
     */
    public addNoteOffline(taskId: string, content: string): void {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (task) {
            const newNote: TaskNote = {
                id: this.generateOfflineId(),
                taskId: taskId,
                userId: this.getCurrentUserId(),
                content,
                createdAt: new Date()
            };

            task.notes = task.notes || [];
            task.notes.push(newNote);
            this.saveTasks(tasks);

            // Agregar acción pendiente
            this.addPendingAction({
                type: 'ADD_NOTE',
                data: { taskId, note: newNote },
                timestamp: Date.now(),
                localId: newNote.id
            });
        }
    }

    /**
     * Sincronizar datos con el servidor
     */
    public async syncWithServer(): Promise<SyncResult> {
        if (!this.isOnline || this.syncInProgress) {
            return {
                success: false,
                message: this.syncInProgress ? 'Sincronización en progreso' : 'Sin conexión a internet'
            };
        }

        this.syncInProgress = true;

        try {
            // 1. Descargar datos del servidor
            const serverTasks = await this.fetchTasksFromServer();
            
            // 2. Resolver conflictos
            const resolvedTasks = this.resolveConflicts(serverTasks, this.getTasks());
            
            // 3. Sincronizar acciones pendientes
            await this.syncPendingActions();
            
            // 4. Guardar datos sincronizados
            this.saveTasks(resolvedTasks);
            this.updateLastSync();

            return {
                success: true,
                message: 'Sincronización completada exitosamente',
                syncedTasks: resolvedTasks.length,
                pendingActions: this.pendingActions.length
            };

        } catch (error) {
            console.error('Error during sync:', error);
            return {
                success: false,
                message: 'Error durante la sincronización: ' + (error instanceof Error ? error.message : 'Error desconocido')
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Obtener información de sincronización
     */
    public getSyncInfo(): SyncInfo {
        const lastSync = localStorage.getItem(OfflineManager.STORAGE_KEYS.LAST_SYNC);
        return {
            isOnline: this.isOnline,
            lastSync: lastSync ? new Date(parseInt(lastSync)) : null,
            pendingActions: this.pendingActions.length,
            syncInProgress: this.syncInProgress,
            localTasks: this.getTasks().length
        };
    }

    /**
     * Limpiar datos offline
     */
    public clearOfflineData(): void {
        Object.values(OfflineManager.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.pendingActions = [];
    }

    /**
     * Manejar evento online
     */
    private handleOnline(): void {
        console.log('Conexión restaurada - iniciando sincronización');
        this.syncWithServer();
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('offline-manager-online', {
            detail: { pendingActions: this.pendingActions.length }
        }));
    }

    /**
     * Manejar evento offline
     */
    private handleOffline(): void {
        console.log('Conexión perdida - modo offline activado');
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('offline-manager-offline'));
    }

    /**
     * Cargar acciones pendientes
     */
    private loadPendingActions(): void {
        try {
            const actionsJson = localStorage.getItem(OfflineManager.STORAGE_KEYS.PENDING_ACTIONS);
            this.pendingActions = actionsJson ? JSON.parse(actionsJson) : [];
        } catch (error) {
            console.error('Error loading pending actions:', error);
            this.pendingActions = [];
        }
    }

    /**
     * Guardar acciones pendientes
     */
    private savePendingActions(): void {
        try {
            localStorage.setItem(OfflineManager.STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(this.pendingActions));
        } catch (error) {
            console.error('Error saving pending actions:', error);
        }
    }

    /**
     * Agregar acción pendiente
     */
    private addPendingAction(action: OfflineAction): void {
        this.pendingActions.push(action);
        this.savePendingActions();
    }

    /**
     * Sincronizar acciones pendientes
     */
    private async syncPendingActions(): Promise<void> {
        const actionsToSync = [...this.pendingActions];
        
        for (const action of actionsToSync) {
            try {
                await this.executeAction(action);
                
                // Remover acción exitosa
                this.pendingActions = this.pendingActions.filter(a => a !== action);
                
            } catch (error) {
                console.error('Error executing pending action:', action, error);
                // Mantener la acción para reintento posterior
            }
        }
        
        this.savePendingActions();
    }

    /**
     * Ejecutar acción pendiente
     */
    private async executeAction(action: OfflineAction): Promise<void> {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        switch (action.type) {
            case 'CREATE_TASK':
                await fetch('/api/tasks', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(action.data)
                });
                break;

            case 'UPDATE_TASK':
                await fetch(`/api/tasks/${action.data.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(action.data.updates)
                });
                break;

            case 'DELETE_TASK':
                await fetch(`/api/tasks/${action.data.id}`, {
                    method: 'DELETE',
                    headers
                });
                break;

            case 'ADD_NOTE':
                await fetch(`/api/tasks/${action.data.taskId}/notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ content: action.data.note.content })
                });
                break;
        }
    }

    /**
     * Obtener tareas del servidor
     */
    private async fetchTasksFromServer(): Promise<Task[]> {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/tasks', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching tasks: ${response.status}`);
        }

        const data = await response.json();
        return data.data?.items || [];
    }

    /**
     * Resolver conflictos entre datos locales y del servidor
     */
    private resolveConflicts(serverTasks: Task[], localTasks: Task[]): Task[] {
        const resolved: Task[] = [];
        const serverTasksMap = new Map(serverTasks.map(t => [t.id, t]));
        const localTasksMap = new Map(localTasks.map(t => [t.id, t]));

        // Agregar tareas del servidor
        for (const serverTask of serverTasks) {
            const localTask = localTasksMap.get(serverTask.id);
            
            if (localTask) {
                // Resolver conflicto - usar la versión más reciente
                const serverDate = new Date(serverTask.createdAt);
                const localDate = new Date(localTask.createdAt);
                
                resolved.push(serverDate >= localDate ? serverTask : localTask);
            } else {
                resolved.push(serverTask);
            }
        }

        // Agregar tareas locales que no están en el servidor (nuevas)
        for (const localTask of localTasks) {
            if (!serverTasksMap.has(localTask.id) && this.isOfflineId(localTask.id)) {
                resolved.push(localTask);
            }
        }

        return resolved;
    }

    /**
     * Generar ID offline temporal
     */
    private generateOfflineId(): string {
        return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Verificar si es un ID offline
     */
    private isOfflineId(id: string): boolean {
        return id.startsWith('offline_');
    }

    /**
     * Obtener ID del usuario actual
     */
    private getCurrentUserId(): string {
        try {
            const userData = localStorage.getItem('auth_user');
            if (userData) {
                const user = JSON.parse(userData);
                return user.id;
            }
        } catch (error) {
            console.error('Error getting current user ID:', error);
        }
        return 'unknown';
    }

    /**
     * Actualizar timestamp de última sincronización
     */
    private updateLastSync(): void {
        localStorage.setItem(OfflineManager.STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    }
}

// Tipos para el gestor offline
interface OfflineAction {
    type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'ADD_NOTE';
    data: any;
    timestamp: number;
    localId: string;
}

interface SyncResult {
    success: boolean;
    message: string;
    syncedTasks?: number;
    pendingActions?: number;
}

interface SyncInfo {
    isOnline: boolean;
    lastSync: Date | null;
    pendingActions: number;
    syncInProgress: boolean;
    localTasks: number;
}

// Instancia global del gestor offline
export const offlineManager = new OfflineManager();