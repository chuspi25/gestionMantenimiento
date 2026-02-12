// =====================================================
// SCRIPT PARA CREAR USUARIOS
// Uso: node create-user.js <email> <nombre> <contraseña> <rol>
// =====================================================

import bcrypt from 'bcrypt';
import { query, initializeDatabase } from './src/backend/utils/database.js';

async function createUser(email, name, password, role = 'operator') {
    try {
        // Validar parámetros
        if (!email || !name || !password) {
            throw new Error('Email, nombre y contraseña son requeridos');
        }

        if (!['admin', 'supervisor', 'operator'].includes(role)) {
            throw new Error('Rol debe ser: admin, supervisor, o operator');
        }

        // Inicializar base de datos
        initializeDatabase();

        // Generar hash de contraseña
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insertar usuario
        const result = await query(`
            INSERT INTO users (email, name, password_hash, role, is_active) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active
            RETURNING id, email, name, role, is_active, created_at
        `, [email, name, passwordHash, role, true]);

        console.log('✅ Usuario creado/actualizado exitosamente:');
        console.log('📧 Email:', result.rows[0].email);
        console.log('👤 Nombre:', result.rows[0].name);
        console.log('🔑 Rol:', result.rows[0].role);
        console.log('📅 Creado:', result.rows[0].created_at);
        console.log('🔐 Contraseña:', password);

    } catch (error) {
        console.error('❌ Error creando usuario:', error.message);
        process.exit(1);
    }
}

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.length < 3) {
    console.log('Uso: node create-user.js <email> <nombre> <contraseña> [rol]');
    console.log('Ejemplo: node create-user.js pepa@pepa.es "Pepa Prueba" Activa2025 operator');
    process.exit(1);
}

const [email, name, password, role] = args;

// Crear usuario
createUser(email, name, password, role);