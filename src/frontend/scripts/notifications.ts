/**
 * Sistema de notificaciones global para la aplicación
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
    type: NotificationType;
    message: string;
    duration?: number; // en milisegundos, por defecto 4000
    persistent?: boolean; // si es true, no se auto-elimina
}

/**
 * Clase para manejar notificaciones globales
 */
export class NotificationManager {
    private container!: HTMLElement;
    private notifications: Map<string, HTMLElement> = new Map();

    constructor() {
        this.createContainer();
    }

    /**
     * Crear el contenedor de notificaciones
     */
    private createContainer(): void {
        // Verificar si ya existe
        let container = document.getElementById('notification-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            
            // Asegurar que se agregue al body cuando esté listo
            if (document.body) {
                document.body.appendChild(container);
            } else {
                // Si el body no está listo, esperar
                document.addEventListener('DOMContentLoaded', () => {
                    if (container) {
                        document.body.appendChild(container);
                    }
                });
            }
        }
        
        this.container = container;
    }

    /**
     * Mostrar una notificación
     */
    public show(options: NotificationOptions): string {
        // Asegurar que el contenedor existe
        if (!this.container || !this.container.parentNode) {
            this.createContainer();
        }
        
        const id = this.generateId();
        const notification = this.createNotification(id, options);
        
        this.container.appendChild(notification);
        this.notifications.set(id, notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-eliminar si no es persistente
        if (!options.persistent) {
            const duration = options.duration || 4000;
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }
        
        console.log(`📢 Notificación mostrada: ${options.type} - ${options.message}`);
        
        return id;
    }

    /**
     * Mostrar notificación de éxito
     */
    public success(message: string, duration?: number): string {
        return this.show({
            type: 'success',
            message,
            duration
        });
    }

    /**
     * Mostrar notificación de error
     */
    public error(message: string, persistent?: boolean): string {
        return this.show({
            type: 'error',
            message,
            persistent,
            duration: persistent ? undefined : 6000
        });
    }

    /**
     * Mostrar notificación de advertencia
     */
    public warning(message: string, duration?: number): string {
        return this.show({
            type: 'warning',
            message,
            duration: duration || 5000
        });
    }

    /**
     * Mostrar notificación informativa
     */
    public info(message: string, duration?: number): string {
        return this.show({
            type: 'info',
            message,
            duration
        });
    }

    /**
     * Ocultar una notificación específica
     */
    public hide(id: string): void {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.classList.add('hide');
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications.delete(id);
            }, 300);
        }
    }

    /**
     * Ocultar todas las notificaciones
     */
    public hideAll(): void {
        this.notifications.forEach((_, id) => {
            this.hide(id);
        });
    }

    /**
     * Crear elemento de notificación
     */
    private createNotification(id: string, options: NotificationOptions): HTMLElement {
        const notification = document.createElement('div');
        notification.className = `notification notification-${options.type}`;
        notification.setAttribute('data-id', id);
        
        const icon = this.getIcon(options.type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${options.message}</span>
                <button class="notification-close" onclick="notificationManager.hide('${id}')" title="Cerrar">
                    ✕
                </button>
            </div>
        `;
        
        return notification;
    }

    /**
     * Obtener icono según el tipo
     */
    private getIcon(type: NotificationType): string {
        switch (type) {
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'info':
                return 'ℹ️';
            default:
                return 'ℹ️';
        }
    }

    /**
     * Generar ID único
     */
    private generateId(): string {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Instancia global
export const notificationManager = new NotificationManager();

// Hacer disponible globalmente para uso en HTML
(window as any).notificationManager = notificationManager;