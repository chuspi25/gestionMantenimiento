import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // máximo número de conexiones en el pool
  idleTimeoutMillis?: number; // tiempo de espera antes de cerrar conexiones inactivas
  connectionTimeoutMillis?: number; // tiempo de espera para obtener una conexión
}

// Obtener configuración desde variables de entorno
function getDatabaseConfig(): DatabaseConfig {
  // Para pruebas, usar configuración específica de test
  if (process.env.NODE_ENV === 'test') {
    return {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'maintenance_test_db',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      max: 5, // Menos conexiones para pruebas
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
    };
  }

  // Priorizar DATABASE_URL si está disponible
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    } as any;
  }

  // Usar configuración individual
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'maintenance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  };
}

// Pool de conexiones global
let pool: Pool | null = null;

// Inicializar el pool de conexiones
export function initializeDatabase(): Pool {
  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();
  
  pool = new Pool(config);

  // Manejar errores del pool
  pool.on('error', (err) => {
    console.error('Error inesperado en el pool de base de datos:', err);
  });

  // Manejar conexiones
  pool.on('connect', () => {
    console.log('Nueva conexión establecida a la base de datos');
  });

  pool.on('remove', () => {
    console.log('Conexión removida del pool');
  });

  console.log('Pool de base de datos inicializado');
  return pool;
}

// Obtener el pool de conexiones
export function getPool(): Pool {
  if (!pool) {
    return initializeDatabase();
  }
  return pool;
}

// Ejecutar una consulta
export async function query(text: string, params?: any[]): Promise<any> {
  const client = getPool();
  
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    // Log de consultas en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('Consulta ejecutada:', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Error en consulta de base de datos:', error);
    throw error;
  }
}

// Ejecutar una transacción
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Verificar la conexión a la base de datos
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('Conexión a base de datos exitosa:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    return false;
  }
}

// Cerrar el pool de conexiones
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Pool de base de datos cerrado');
  }
}

// Crear las tablas necesarias
export async function createTables(): Promise<void> {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'supervisor', 'operator')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_login TIMESTAMP WITH TIME ZONE,
      profile_image TEXT
    );
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('electrical', 'mechanical')),
      priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      assigned_to UUID REFERENCES users(id),
      created_by UUID NOT NULL REFERENCES users(id),
      location VARCHAR(255) NOT NULL,
      required_tools TEXT[] DEFAULT '{}',
      estimated_duration INTEGER NOT NULL, -- en minutos
      due_date TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE
    );
  `;

  const createTaskNotesTable = `
    CREATE TABLE IF NOT EXISTS task_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  const createTaskAttachmentsTable = `
    CREATE TABLE IF NOT EXISTS task_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
  `;

  try {
    await query(createUsersTable);
    await query(createTasksTable);
    await query(createTaskNotesTable);
    await query(createTaskAttachmentsTable);
    await query(createIndexes);
    
    console.log('Tablas de base de datos creadas exitosamente');
  } catch (error) {
    console.error('Error al crear tablas:', error);
    throw error;
  }
}

// Función para inicializar la base de datos completa
export async function initializeFullDatabase(): Promise<void> {
  try {
    initializeDatabase();
    const isConnected = await testConnection();
    
    if (!isConnected) {
      throw new Error('No se pudo establecer conexión con la base de datos');
    }
    
    await createTables();
    console.log('Base de datos inicializada completamente');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    throw error;
  }
}
