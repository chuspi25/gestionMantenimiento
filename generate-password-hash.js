// =====================================================
// GENERADOR DE HASH DE CONTRASEÑA
// =====================================================

import bcrypt from 'bcrypt';

async function generatePasswordHash() {
    const password = 'Activa2025';
    const saltRounds = 12;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('='.repeat(50));
        console.log('HASH DE CONTRASEÑA GENERADO');
        console.log('='.repeat(50));
        console.log('Contraseña:', password);
        console.log('Hash:', hash);
        console.log('='.repeat(50));
        
        // Verificar que el hash funciona
        const isValid = await bcrypt.compare(password, hash);
        console.log('Verificación:', isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO');
        console.log('='.repeat(50));
        
        // Generar SQL con el hash correcto
        console.log('\nSQL PARA INSERTAR USUARIO:');
        console.log(`INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
    'pepa@pepa.es',
    'Pepa Usuario de Prueba',
    '${hash}',
    'operator',
    true
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash;`);
        
    } catch (error) {
        console.error('Error generando hash:', error);
    }
}

// Ejecutar directamente
generatePasswordHash();

export { generatePasswordHash };