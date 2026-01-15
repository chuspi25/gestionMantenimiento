import { vi } from 'vitest';
import dotenv from 'dotenv';

// Cargar variables de entorno para pruebas
dotenv.config({ path: '.env.test' });

// Configuración global para tests
global.vi = vi;