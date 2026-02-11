import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function crearAdmin() {
  try {
    const email = 'admin@admin.com';
    const password = 'admin123';
    const name = 'Administrador';
    const role = 'admin';

    console.log('🔐 Generando hash de contraseña...');
    const passwordHash = await bcrypt.hash(password, 12);
    
    console.log('📝 Insertando usuario en la base de datos...');
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active
       RETURNING id, email, name, role, is_active, created_at`,
      [email, name, passwordHash, role, true]
    );

    console.log('\n✅ Usuario administrador creado/actualizado exitosamente:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', email);
    console.log('🔑 Contraseña:', password);
    console.log('👤 Nombre:', name);
    console.log('🎭 Rol:', role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

crearAdmin();
