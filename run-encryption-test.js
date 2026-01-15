import { spawn } from 'child_process';

// Ejecutar solo el test de encriptación
const testProcess = spawn('npm', ['test', '--', 'tests/backend/properties/data-encryption.properties.test.ts', '--run'], {
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  console.log(`\nTest process exited with code ${code}`);
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('Error running test:', error);
  process.exit(1);
});