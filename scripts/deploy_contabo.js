// scripts/deploy_contabo.js - Automatizador de Despliegue Directo a Contabo VPS (217.216.84.239)
// Sincroniza cambios con GitHub y actualiza el servidor en Contabo vía SSH + PM2 en segundos.

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const VPS_HOST = 'root@217.216.84.239';
const SSH_KEY = path.join(os.homedir(), '.ssh', 'contabo_vfx_ed25519');
const REMOTE_DIR = '/opt/suite-animalitos';
const PUBLIC_URL = 'https://suite-animalitos.217-216-84-239.sslip.io/';

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('🚀 [DEPLOY CONTABO] Iniciando sincronización y despliegue a Contabo VPS...');

  const currentBranch = runCmd('git rev-parse --abbrev-ref HEAD') || 'main';
  const gitStatus = runCmd('git status --porcelain');
  const commitMsg = process.argv.slice(2).join(' ') || '';

  if (commitMsg && gitStatus) {
    console.log(`📝 Creando commit: "${commitMsg}"...`);
    runCmd('git add .');
    runCmd(`git commit -m "${commitMsg}"`);
  }

  console.log(`⬆️ Enviando commits a GitHub (${currentBranch})...`);
  try {
    execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
    console.log('✅ Push a GitHub completado.');
  } catch (err) {
    console.warn('⚠️ Nota durante git push:', err.message);
  }

  console.log('⚡ Actualizando /opt/suite-animalitos en Contabo VPS y recargando PM2...');
  const remoteCmd = [
    `cd ${REMOTE_DIR}`,
    'git fetch origin main',
    'git reset --hard origin/main',
    'npm install --omit=dev --no-audit --no-fund',
    'IS_RENDER=true IS_CLOUD=true CONTABO=true PORT=4500 pm2 restart suite-animalitos --update-env || IS_RENDER=true IS_CLOUD=true CONTABO=true PORT=4500 pm2 start server.js --name suite-animalitos',
    'pm2 save'
  ].join(' && ');

  execSync(`ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${VPS_HOST} "${remoteCmd}"`, { stdio: 'inherit' });

  console.log('\n🎉 ¡DESPLIEGUE EN CONTABO VPS EXITOSO Y EN VIVO!');
  console.log(`🌐 URL Principal: ${PUBLIC_URL}`);
  console.log('🌐 URL Corta:     https://animalitos.217-216-84-239.sslip.io/');
}

main().catch(err => {
  console.error('❌ Error en deploy a Contabo:', err.message);
  process.exit(1);
});
