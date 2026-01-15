import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Niveles de log
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Interfaz para entrada de log
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

// Interfaz para configuración del logger
export interface LoggerConfig {
  logLevel: LogLevel;
  logDirectory: string;
  maxFileSize: number; // en bytes
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  sanitizeData: boolean;
  encryptLogs: boolean;
}

// Configuración por defecto
const DEFAULT_CONFIG: LoggerConfig = {
  logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  logDirectory: process.env.LOG_DIRECTORY || './logs',
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
  enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
  enableFile: process.env.LOG_ENABLE_FILE !== 'false',
  sanitizeData: process.env.LOG_SANITIZE_DATA !== 'false',
  encryptLogs: process.env.LOG_ENCRYPT === 'true'
};

// Patrones para datos sensibles que deben ser sanitizados
const SENSITIVE_PATTERNS = [
  /password["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /token["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /authorization["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /secret["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /key["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /email["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /phone["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /ssn["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /credit[_\s]*card["\s]*[:=]["\s]*[^"\s,}]+/gi,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Números de tarjeta de crédito
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email addresses
];

class SecureLogger {
  private config: LoggerConfig;
  private logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDirectory();
  }

  /**
   * Asegura que el directorio de logs existe
   */
  private ensureLogDirectory(): void {
    try {
      if (this.config.enableFile && !fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Error creando directorio de logs:', error);
    }
  }

  /**
   * Sanitiza datos sensibles en el mensaje de log
   */
  private sanitizeMessage(message: string): string {
    if (!this.config.sanitizeData) {
      return message;
    }

    let sanitized = message;
    
    // Aplicar patrones de sanitización
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        const parts = match.split(/[:=]/);
        if (parts.length >= 2) {
          return `${parts[0]}:***REDACTED***`;
        }
        return '***REDACTED***';
      });
    });

    return sanitized;
  }

  /**
   * Sanitiza metadatos removiendo campos sensibles
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    if (!this.config.sanitizeData || !metadata) {
      return metadata;
    }

    const sanitized = { ...metadata };
    const sensitiveFields = [
      'password', 'token', 'authorization', 'secret', 'key', 
      'email', 'phone', 'ssn', 'creditCard', 'personalInfo'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    // Sanitizar campos anidados
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeMetadata(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Formatea la entrada de log
   */
  private formatLogEntry(entry: LogEntry): string {
    const sanitizedEntry = {
      ...entry,
      message: this.sanitizeMessage(entry.message),
      metadata: entry.metadata ? this.sanitizeMetadata(entry.metadata) : undefined
    };

    return JSON.stringify(sanitizedEntry);
  }

  /**
   * Encripta el contenido del log si está habilitado
   */
  private encryptLogContent(content: string): string {
    if (!this.config.encryptLogs) {
      return content;
    }

    try {
      const key = process.env.LOG_ENCRYPTION_KEY;
      if (!key) {
        console.warn('LOG_ENCRYPTION_KEY no configurada, logs no serán encriptados');
        return content;
      }

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
      
      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Error encriptando log:', error);
      return content; // Fallback a contenido sin encriptar
    }
  }

  /**
   * Obtiene el nombre del archivo de log actual
   */
  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.config.logDirectory, `app-${date}.log`);
  }

  /**
   * Rota archivos de log si es necesario
   */
  private rotateLogsIfNeeded(): void {
    try {
      const logFile = this.getLogFileName();
      
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        
        if (stats.size >= this.config.maxFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
          
          fs.renameSync(logFile, rotatedFile);
          
          // Limpiar archivos antiguos
          this.cleanOldLogFiles();
        }
      }
    } catch (error) {
      console.error('Error rotando logs:', error);
    }
  }

  /**
   * Limpia archivos de log antiguos
   */
  private cleanOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Mantener solo los archivos más recientes
      if (files.length > this.config.maxFiles) {
        const filesToDelete = files.slice(this.config.maxFiles);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Error eliminando archivo de log ${file.name}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error limpiando archivos de log antiguos:', error);
    }
  }

  /**
   * Escribe el log al archivo
   */
  private writeToFile(formattedEntry: string): void {
    if (!this.config.enableFile) {
      return;
    }

    try {
      this.rotateLogsIfNeeded();
      
      const logFile = this.getLogFileName();
      const encryptedContent = this.encryptLogContent(formattedEntry);
      
      fs.appendFileSync(logFile, encryptedContent + '\n', 'utf8');
    } catch (error) {
      console.error('Error escribiendo al archivo de log:', error);
    }
  }

  /**
   * Escribe el log a la consola
   */
  private writeToConsole(entry: LogEntry, _formattedEntry: string): void {
    if (!this.config.enableConsole) {
      return;
    }

    const colorCodes = {
      error: '\x1b[31m', // Rojo
      warn: '\x1b[33m',  // Amarillo
      info: '\x1b[36m',  // Cian
      debug: '\x1b[37m'  // Blanco
    };

    const resetCode = '\x1b[0m';
    const color = colorCodes[entry.level] || colorCodes.info;
    
    console.log(`${color}[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${resetCode}`);
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`${color}Metadata:${resetCode}`, this.sanitizeMetadata(entry.metadata));
    }
  }

  /**
   * Verifica si el nivel de log debe ser procesado
   */
  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.config.logLevel];
  }

  /**
   * Método principal de logging
   */
  private log(level: LogLevel, message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
      };

      const formattedEntry = this.formatLogEntry(entry);
      
      this.writeToConsole(entry, formattedEntry);
      this.writeToFile(formattedEntry);
    } catch (error) {
      console.error('Error en el sistema de logging:', error);
    }
  }

  /**
   * Log de error
   */
  error(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('error', message, context);
  }

  /**
   * Log de advertencia
   */
  warn(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('warn', message, context);
  }

  /**
   * Log de información
   */
  info(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('info', message, context);
  }

  /**
   * Log de debug
   */
  debug(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('debug', message, context);
  }

  /**
   * Log de evento de seguridad
   */
  security(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('warn', `[SECURITY] ${message}`, {
      ...context,
      context: 'security'
    });
  }

  /**
   * Log de auditoría
   */
  audit(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('info', `[AUDIT] ${message}`, {
      ...context,
      context: 'audit'
    });
  }

  /**
   * Actualiza la configuración del logger
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.ensureLogDirectory();
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Instancia global del logger
export const secureLogger = new SecureLogger();

// Funciones de conveniencia para uso directo
export const logError = (message: string, context?: any) => secureLogger.error(message, context);
export const logWarn = (message: string, context?: any) => secureLogger.warn(message, context);
export const logInfo = (message: string, context?: any) => secureLogger.info(message, context);
export const logDebug = (message: string, context?: any) => secureLogger.debug(message, context);
export const logSecurity = (message: string, context?: any) => secureLogger.security(message, context);
export const logAudit = (message: string, context?: any) => secureLogger.audit(message, context);

export default secureLogger;
