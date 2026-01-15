import { offlineManager } from './offlineManager.js';
/**
 * Indicador de estado de conexión y sincronización
 */
export class SyncIndicator {
    container;
    isVisible = false;
    currentStatus = 'online';
    syncInfo = null;
    constructor(containerId) {
        // Crear o encontrar contenedor
        if (containerId) {
            const existing = document.getElementById(containerId);
            if (existing) {
                this.container = existing;
            }
            else {
                throw new Error(`Container with id "${containerId}" not found`);
            }
        }
        else {
            this.container = this.createDefaultContainer();
        }
        this.initialize();
    }
    /**
     * Inicializar el indicador
     */
    initialize() {
        this.render();
        this.setupEventListeners();
        this.updateStatus();
        // Actualizar estado cada 30 segundos
        setInterval(() => {
            this.updateStatus();
        }, 30000);
    }
    /**
     * Crear contenedor por defecto
     */
    createDefaultContainer() {
        const container = document.createElement('div');
        container.id = 'sync-indicator';
        container.className = 'sync-indicator-container';
        // Agregar al body
        document.body.appendChild(container);
        return container;
    }
    /**
     * Renderizar el indicador
     */
    render() {
        this.container.innerHTML = `
            <div class="sync-indicator ${this.isVisible ? 'visible' : 'hidden'}">
                <div class="sync-status" id="sync-status">
                    <div class="status-icon" id="status-icon">
                        ${this.getStatusIcon()}
                    </div>
                    <div class="status-text" id="status-text">
                        ${this.getStatusText()}
                    </div>
                </div>
                
                <div class="sync-details" id="sync-details" style="display: none;">
                    <div class="detail-item">
                        <span class="detail-label">Estado:</span>
                        <span class="detail-value" id="connection-status">${this.getConnectionText()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Última sincronización:</span>
                        <span class="detail-value" id="last-sync">${this.getLastSyncText()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Acciones pendientes:</span>
                        <span class="detail-value" id="pending-actions">${this.getPendingActionsText()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Tareas locales:</span>
                        <span class="detail-value" id="local-tasks">${this.getLocalTasksText()}</span>
                    </div>
                </div>
                
                <div class="sync-actions" id="sync-actions" style="display: none;">
                    <button class="sync-button" id="manual-sync-btn" ${this.currentStatus === 'offline' ? 'disabled' : ''}>
                        <span class="sync-icon">🔄</span>
                        Sincronizar ahora
                    </button>
                    <button class="retry-button" id="retry-btn" style="display: none;">
                        <span class="retry-icon">↻</span>
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Click en el indicador para mostrar/ocultar detalles
        const syncStatus = this.container.querySelector('#sync-status');
        syncStatus?.addEventListener('click', () => {
            this.toggleDetails();
        });
        // Botón de sincronización manual
        const manualSyncBtn = this.container.querySelector('#manual-sync-btn');
        manualSyncBtn?.addEventListener('click', () => {
            this.performManualSync();
        });
        // Botón de reintentar
        const retryBtn = this.container.querySelector('#retry-btn');
        retryBtn?.addEventListener('click', () => {
            this.performManualSync();
        });
        // Eventos del offline manager
        window.addEventListener('offline-manager-online', () => {
            this.handleOnline();
        });
        window.addEventListener('offline-manager-offline', () => {
            this.handleOffline();
        });
        // Eventos nativos de conectividad
        window.addEventListener('online', () => {
            this.updateStatus();
        });
        window.addEventListener('offline', () => {
            this.updateStatus();
        });
    }
    /**
     * Actualizar estado del indicador
     */
    async updateStatus() {
        try {
            this.syncInfo = offlineManager.getSyncInfo();
            // Determinar estado actual
            if (!this.syncInfo.isOnline) {
                this.currentStatus = 'offline';
            }
            else if (this.syncInfo.syncInProgress) {
                this.currentStatus = 'syncing';
            }
            else if (this.syncInfo.pendingActions > 0) {
                this.currentStatus = 'pending';
            }
            else {
                this.currentStatus = 'online';
            }
            // Actualizar UI
            this.updateUI();
            // Mostrar indicador si hay algo importante que mostrar
            this.updateVisibility();
        }
        catch (error) {
            console.error('Error updating sync status:', error);
            this.currentStatus = 'error';
            this.updateUI();
        }
    }
    /**
     * Actualizar UI del indicador
     */
    updateUI() {
        const statusIcon = this.container.querySelector('#status-icon');
        const statusText = this.container.querySelector('#status-text');
        const connectionStatus = this.container.querySelector('#connection-status');
        const lastSync = this.container.querySelector('#last-sync');
        const pendingActions = this.container.querySelector('#pending-actions');
        const localTasks = this.container.querySelector('#local-tasks');
        const manualSyncBtn = this.container.querySelector('#manual-sync-btn');
        const retryBtn = this.container.querySelector('#retry-btn');
        if (statusIcon)
            statusIcon.innerHTML = this.getStatusIcon();
        if (statusText)
            statusText.textContent = this.getStatusText();
        if (connectionStatus)
            connectionStatus.textContent = this.getConnectionText();
        if (lastSync)
            lastSync.textContent = this.getLastSyncText();
        if (pendingActions)
            pendingActions.textContent = this.getPendingActionsText();
        if (localTasks)
            localTasks.textContent = this.getLocalTasksText();
        // Actualizar botones
        if (manualSyncBtn) {
            manualSyncBtn.disabled = this.currentStatus === 'offline' || this.currentStatus === 'syncing';
            manualSyncBtn.textContent = this.currentStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar ahora';
        }
        if (retryBtn) {
            retryBtn.style.display = this.currentStatus === 'error' ? 'block' : 'none';
        }
        // Actualizar clases CSS
        this.container.className = `sync-indicator-container status-${this.currentStatus} ${this.isVisible ? 'visible' : 'hidden'}`;
    }
    /**
     * Actualizar visibilidad del indicador
     */
    updateVisibility() {
        const shouldShow = this.currentStatus === 'offline' ||
            this.currentStatus === 'syncing' ||
            this.currentStatus === 'pending' ||
            this.currentStatus === 'error';
        if (shouldShow !== this.isVisible) {
            this.isVisible = shouldShow;
            this.updateUI();
        }
    }
    /**
     * Mostrar/ocultar detalles
     */
    toggleDetails() {
        const details = this.container.querySelector('#sync-details');
        const actions = this.container.querySelector('#sync-actions');
        if (details && actions) {
            const isVisible = details.style.display !== 'none';
            details.style.display = isVisible ? 'none' : 'block';
            actions.style.display = isVisible ? 'none' : 'block';
        }
    }
    /**
     * Realizar sincronización manual
     */
    async performManualSync() {
        if (this.currentStatus === 'offline' || this.currentStatus === 'syncing') {
            return;
        }
        try {
            this.currentStatus = 'syncing';
            this.updateUI();
            const result = await offlineManager.syncWithServer();
            if (result.success) {
                this.showNotification('Sincronización completada', 'success');
            }
            else {
                this.showNotification(result.message, 'error');
                this.currentStatus = 'error';
            }
        }
        catch (error) {
            console.error('Error during manual sync:', error);
            this.showNotification('Error durante la sincronización', 'error');
            this.currentStatus = 'error';
        }
        finally {
            this.updateStatus();
        }
    }
    /**
     * Manejar evento online
     */
    handleOnline() {
        this.showNotification('Conexión restaurada - sincronizando datos', 'info');
        this.updateStatus();
    }
    /**
     * Manejar evento offline
     */
    handleOffline() {
        this.showNotification('Sin conexión - trabajando en modo offline', 'warning');
        this.updateStatus();
    }
    /**
     * Mostrar notificación
     */
    showNotification(message, type) {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `sync-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        // Agregar al contenedor
        this.container.appendChild(notification);
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    /**
     * Obtener icono de estado
     */
    getStatusIcon() {
        const icons = {
            'online': '🟢',
            'offline': '🔴',
            'syncing': '🔄',
            'pending': '🟡',
            'error': '⚠️'
        };
        return icons[this.currentStatus] || '❓';
    }
    /**
     * Obtener texto de estado
     */
    getStatusText() {
        const texts = {
            'online': 'En línea',
            'offline': 'Sin conexión',
            'syncing': 'Sincronizando...',
            'pending': 'Pendiente de sincronizar',
            'error': 'Error de sincronización'
        };
        return texts[this.currentStatus] || 'Estado desconocido';
    }
    /**
     * Obtener texto de conexión
     */
    getConnectionText() {
        return this.syncInfo?.isOnline ? 'Conectado' : 'Desconectado';
    }
    /**
     * Obtener texto de última sincronización
     */
    getLastSyncText() {
        if (!this.syncInfo?.lastSync) {
            return 'Nunca';
        }
        const lastSync = new Date(this.syncInfo.lastSync);
        const now = new Date();
        const diffMs = now.getTime() - lastSync.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) {
            return 'Hace menos de 1 minuto';
        }
        else if (diffMins < 60) {
            return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
        }
        else {
            const diffHours = Math.floor(diffMins / 60);
            return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
        }
    }
    /**
     * Obtener texto de acciones pendientes
     */
    getPendingActionsText() {
        const count = this.syncInfo?.pendingActions || 0;
        return count === 0 ? 'Ninguna' : `${count} acción${count !== 1 ? 'es' : ''}`;
    }
    /**
     * Obtener texto de tareas locales
     */
    getLocalTasksText() {
        const count = this.syncInfo?.localTasks || 0;
        return `${count} tarea${count !== 1 ? 's' : ''}`;
    }
    /**
     * Obtener icono de notificación
     */
    getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    /**
     * Mostrar indicador manualmente
     */
    show() {
        this.isVisible = true;
        this.updateUI();
    }
    /**
     * Ocultar indicador manualmente
     */
    hide() {
        this.isVisible = false;
        this.updateUI();
    }
    /**
     * Obtener estado actual
     */
    getCurrentStatus() {
        return this.currentStatus;
    }
    /**
     * Forzar actualización
     */
    forceUpdate() {
        this.updateStatus();
    }
}
// Instancia global del indicador de sincronización
export const syncIndicator = new SyncIndicator();
