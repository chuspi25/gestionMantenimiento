-- =====================================================
-- CREAR USUARIO DE PRUEBA
-- Email: pepa@pepa.es
-- Contraseña: Activa2025
-- =====================================================

-- Insertar usuario de prueba
-- Hash bcrypt de "Activa2025" con salt rounds 12
INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
    'pepa@pepa.es',
    'Pepa Usuario de Prueba',
    '$2b$12$aMzjDfpxpA8Ht7AjQ//Hb.TPP8A4FtvgzsrhESGqrD9BI8Zfj5PX6', -- Activa2025
    'operator',
    true
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Verificar que el usuario se creó correctamente
SELECT id, email, name, role, is_active, created_at 
FROM users 
WHERE email = 'pepa@pepa.es';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Usuario de prueba creado exitosamente:';
    RAISE NOTICE 'Email: pepa@pepa.es';
    RAISE NOTICE 'Contraseña: Activa2025';
    RAISE NOTICE 'Rol: operator';
END $$;