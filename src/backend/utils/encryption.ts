import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de encriptación
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// Obtener clave de encriptación desde variables de entorno
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY no está configurada en las variables de entorno');
  }
  
  // Si la clave es más corta que 32 bytes, usar PBKDF2 para derivar una clave
  if (key.length < KEY_LENGTH) {
    const salt = process.env.ENCRYPTION_SALT || 'maintenance-app-salt';
    return crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
  }
  
  // Si la clave es exactamente 32 bytes o más, usar los primeros 32 bytes
  return Buffer.from(key.slice(0, KEY_LENGTH), 'utf8');
}

// Interfaz para datos encriptados
export interface EncryptedData {
  encryptedData: string;
  iv: string;
  tag: string;
}

/**
 * Encripta datos sensibles usando AES-256-GCM
 * @param plaintext - Texto plano a encriptar
 * @returns Objeto con datos encriptados, IV y tag de autenticación
 */
export function encryptSensitiveData(plaintext: string): EncryptedData {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Los datos a encriptar deben ser una cadena no vacía');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
    cipher.setAAD(Buffer.from('maintenance-app', 'utf8')); // Additional Authenticated Data
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    console.error('Error encriptando datos:', error);
    throw new Error('Error al encriptar datos sensibles');
  }
}

/**
 * Desencripta datos usando AES-256-GCM
 * @param encryptedData - Objeto con datos encriptados
 * @returns Texto plano desencriptado
 */
export function decryptSensitiveData(encryptedData: EncryptedData): string {
  try {
    if (!encryptedData || !encryptedData.encryptedData || !encryptedData.iv || !encryptedData.tag) {
      throw new Error('Datos encriptados inválidos o incompletos');
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAAD(Buffer.from('maintenance-app', 'utf8'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando datos:', error);
    throw new Error('Error al desencriptar datos sensibles');
  }
}

/**
 * Encripta un objeto completo convirtiendo campos sensibles
 * @param data - Objeto con datos a encriptar
 * @param sensitiveFields - Array de nombres de campos a encriptar
 * @returns Objeto con campos sensibles encriptados
 */
export function encryptObjectFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[]
): T & Record<string, EncryptedData> {
  try {
    const result = { ...data } as any;
    
    for (const field of sensitiveFields) {
      if (data[field] && typeof data[field] === 'string') {
        const encrypted = encryptSensitiveData(data[field] as string);
        result[`${String(field)}_encrypted`] = encrypted;
        delete result[field]; // Remover el campo original
      }
    }
    
    return result as T & Record<string, EncryptedData>;
  } catch (error) {
    console.error('Error encriptando campos del objeto:', error);
    throw new Error('Error al encriptar campos sensibles del objeto');
  }
}

/**
 * Desencripta campos de un objeto
 * @param data - Objeto con campos encriptados
 * @param sensitiveFields - Array de nombres de campos a desencriptar
 * @returns Objeto con campos desencriptados
 */
export function decryptObjectFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[]
): T {
  try {
    const result = { ...data } as any;
    
    for (const field of sensitiveFields) {
      const encryptedField = `${field}_encrypted`;
      if (data[encryptedField] && typeof data[encryptedField] === 'object') {
        const decrypted = decryptSensitiveData(data[encryptedField] as EncryptedData);
        result[field] = decrypted;
        delete result[encryptedField]; // Remover el campo encriptado
      }
    }
    
    return result as T;
  } catch (error) {
    console.error('Error desencriptando campos del objeto:', error);
    throw new Error('Error al desencriptar campos sensibles del objeto');
  }
}

/**
 * Genera un hash seguro para verificación de integridad
 * @param data - Datos para generar el hash
 * @returns Hash SHA-256 en formato hexadecimal
 */
export function generateSecureHash(data: string): string {
  try {
    if (!data || typeof data !== 'string') {
      throw new Error('Los datos para el hash deben ser una cadena no vacía');
    }
    
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  } catch (error) {
    console.error('Error generando hash seguro:', error);
    throw new Error('Error al generar hash de verificación');
  }
}

/**
 * Verifica la integridad de datos usando hash
 * @param data - Datos originales
 * @param expectedHash - Hash esperado
 * @returns true si los datos son íntegros, false en caso contrario
 */
export function verifyDataIntegrity(data: string, expectedHash: string): boolean {
  try {
    if (!data || !expectedHash) {
      return false;
    }
    
    const actualHash = generateSecureHash(data);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Error verificando integridad de datos:', error);
    return false;
  }
}

/**
 * Genera una clave de encriptación aleatoria segura
 * @returns Clave de 32 bytes en formato hexadecimal
 */
export function generateEncryptionKey(): string {
  try {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  } catch (error) {
    console.error('Error generando clave de encriptación:', error);
    throw new Error('Error al generar clave de encriptación');
  }
}

/**
 * Encripta datos para almacenamiento en base de datos
 * Incluye metadatos adicionales para verificación
 * @param data - Datos a encriptar
 * @param context - Contexto adicional para la encriptación
 * @returns Objeto con datos encriptados y metadatos
 */
export function encryptForDatabase(data: string, context: string = 'default'): {
  encrypted: EncryptedData;
  hash: string;
  timestamp: number;
  context: string;
} {
  try {
    const encrypted = encryptSensitiveData(data);
    const hash = generateSecureHash(data);
    const timestamp = Date.now();
    
    return {
      encrypted,
      hash,
      timestamp,
      context
    };
  } catch (error) {
    console.error('Error encriptando para base de datos:', error);
    throw new Error('Error al encriptar datos para almacenamiento');
  }
}

/**
 * Desencripta datos desde base de datos con verificación de integridad
 * @param encryptedRecord - Registro encriptado desde base de datos
 * @returns Datos desencriptados si la verificación es exitosa
 */
export function decryptFromDatabase(encryptedRecord: {
  encrypted: EncryptedData;
  hash: string;
  timestamp: number;
  context: string;
}): string {
  try {
    if (!encryptedRecord || !encryptedRecord.encrypted || !encryptedRecord.hash) {
      throw new Error('Registro encriptado inválido o incompleto');
    }
    
    const decrypted = decryptSensitiveData(encryptedRecord.encrypted);
    
    // Verificar integridad
    if (!verifyDataIntegrity(decrypted, encryptedRecord.hash)) {
      throw new Error('Fallo en la verificación de integridad de datos');
    }
    
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando desde base de datos:', error);
    throw new Error('Error al desencriptar datos desde almacenamiento');
  }
}

/**
 * Limpia datos sensibles de la memoria
 * @param data - Datos a limpiar
 */
export function secureClearData(data: any): void {
  try {
    if (typeof data === 'string') {
      // En Node.js no podemos limpiar completamente la memoria de strings
      // pero podemos sobrescribir la referencia
      data = null;
    } else if (typeof data === 'object' && data !== null) {
      // Limpiar propiedades del objeto
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          data[key] = null;
        }
      }
    }
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.error('Error limpiando datos sensibles:', error);
  }
}
