// Test standalone para verificar que la encriptación funciona
import crypto from 'crypto';

// Configurar variables de entorno para el test
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-maintenance-app-testing-purposes-32-bytes';
process.env.ENCRYPTION_SALT = 'test-salt-for-encryption';

import {
  encryptSensitiveData,
  decryptSensitiveData,
  encryptForDatabase,
  decryptFromDatabase,
  generateSecureHash,
  verifyDataIntegrity
} from './src/backend/utils/encryption.ts';

console.log('🔐 Probando utilidades de encriptación...\n');

// Test 1: Encriptación básica
console.log('1. Test de encriptación/desencriptación básica:');
const testData = 'Datos sensibles de prueba';
try {
  const encrypted = encryptSensitiveData(testData);
  console.log('   ✅ Encriptación exitosa');
  console.log('   📝 Datos encriptados:', encrypted.encryptedData.substring(0, 20) + '...');
  
  const decrypted = decryptSensitiveData(encrypted);
  console.log('   ✅ Desencriptación exitosa');
  console.log('   📝 Datos originales:', testData);
  console.log('   📝 Datos desencriptados:', decrypted);
  console.log('   ✅ Coinciden:', testData === decrypted ? 'SÍ' : 'NO');
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n2. Test de encriptación para base de datos:');
try {
  const dbRecord = encryptForDatabase(testData, 'test-context');
  console.log('   ✅ Encriptación para BD exitosa');
  console.log('   📝 Hash generado:', dbRecord.hash.substring(0, 16) + '...');
  
  const decryptedFromDb = decryptFromDatabase(dbRecord);
  console.log('   ✅ Desencriptación desde BD exitosa');
  console.log('   ✅ Coinciden:', testData === decryptedFromDb ? 'SÍ' : 'NO');
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n3. Test de verificación de integridad:');
try {
  const hash = generateSecureHash(testData);
  console.log('   ✅ Hash generado:', hash.substring(0, 16) + '...');
  
  const isValid = verifyDataIntegrity(testData, hash);
  console.log('   ✅ Verificación de integridad:', isValid ? 'VÁLIDA' : 'INVÁLIDA');
  
  const isInvalid = verifyDataIntegrity(testData + 'modificado', hash);
  console.log('   ✅ Verificación con datos modificados:', isInvalid ? 'VÁLIDA' : 'INVÁLIDA (correcto)');
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n4. Test de diferentes datos aleatorios:');
const testCases = [
  'email@example.com',
  'contraseña123',
  'Notas importantes del mantenimiento',
  '{"user": "admin", "role": "supervisor"}',
  'Información confidencial con caracteres especiales: áéíóú ñ @#$%'
];

testCases.forEach((data, index) => {
  try {
    const encrypted = encryptSensitiveData(data);
    const decrypted = decryptSensitiveData(encrypted);
    const matches = data === decrypted;
    console.log(`   Test ${index + 1}: ${matches ? '✅' : '❌'} "${data.substring(0, 30)}${data.length > 30 ? '...' : ''}"`);
  } catch (error) {
    console.log(`   Test ${index + 1}: ❌ Error - ${error.message}`);
  }
});

console.log('\n🎉 Tests de encriptación completados!');