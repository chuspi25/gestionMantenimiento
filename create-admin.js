// Script para crear un usuario administrador inicial

async function createAdmin() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'jesuspichastor@hotmail.com',
                password: 'Activa2025',
                name: 'Jesús Pichastor',
                role: 'admin'
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Usuario administrador creado exitosamente:');
            console.log('📧 Email: jesuspichastor@hotmail.com');
            console.log('🔑 Contraseña: Activa2025');
            console.log('👤 Rol: admin');
        } else {
            console.log('❌ Error creando usuario administrador:', result.message);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    }
}

createAdmin();