/**
 * Configuración global de la aplicación
 */

// Determinar la URL base de la API según el entorno
export const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

// Configuración de la aplicación
export const APP_CONFIG = {
  apiBaseUrl: API_BASE_URL,
  apiTimeout: 30000, // 30 segundos
  tokenRefreshInterval: 3600000, // 1 hora
  maxRetries: 3,
  retryDelay: 1000, // 1 segundo
};

export default APP_CONFIG;
