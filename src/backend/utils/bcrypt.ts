import * as bcrypt from 'bcrypt';

// Configuración de bcrypt
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

// Hash de contraseña
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validar que la contraseña no esté vacía
    if (!password || password.trim().length === 0) {
      throw new Error('La contraseña no puede estar vacía');
    }

    // Validar longitud mínima
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Generar hash con salt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    console.error('Error al hashear contraseña:', error);
    throw error;
  }
}

// Comparar contraseña con hash
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    // Validar parámetros
    if (!password || !hashedPassword) {
      return false;
    }

    // Comparar contraseña
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('Error al comparar contraseña:', error);
    return false;
  }
}

// Validar fortaleza de contraseña
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Longitud mínima
  if (password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres');
  }

  // Longitud máxima razonable
  if (password.length > 128) {
    errors.push('La contraseña no puede tener más de 128 caracteres');
  }

  // Al menos una letra
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra');
  }

  // Al menos un número (opcional, pero recomendado)
  if (!/\d/.test(password)) {
    // Solo advertencia, no error crítico
    console.warn('Recomendación: La contraseña debería contener al menos un número');
  }

  // No debe ser solo espacios
  if (password.trim().length === 0) {
    errors.push('La contraseña no puede estar compuesta solo de espacios');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generar contraseña temporal (para reseteo)
export function generateTemporaryPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Asegurar al menos un carácter de cada tipo
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // minúscula
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // mayúscula
  password += '0123456789'[Math.floor(Math.random() * 10)]; // número
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // símbolo

  // Completar el resto de la longitud
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Mezclar los caracteres para que no sigan un patrón predecible
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Verificar si un hash es válido (formato bcrypt)
export function isValidBcryptHash(hash: string): boolean {
  // Los hashes de bcrypt tienen un formato específico
  const bcryptRegex = /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/;
  return bcryptRegex.test(hash);
}

// Obtener información del hash (rounds, versión)
export function getHashInfo(hash: string): { version: string; rounds: number } | null {
  try {
    if (!isValidBcryptHash(hash)) {
      return null;
    }

    const parts = hash.split('$');
    if (parts.length < 4) {
      return null;
    }

    return {
      version: parts[1],
      rounds: parseInt(parts[2])
    };
  } catch (error) {
    return null;
  }
}
