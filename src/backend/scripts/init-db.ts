#!/usr/bin/env node

import { initializeFullDatabase, closeDatabase } from '../utils/database.js';

async function main() {
  console.log('🚀 Inicializando base de datos...');
  
  try {
    await initializeFullDatabase();
    console.log('✅ Base de datos inicializada exitosamente');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
