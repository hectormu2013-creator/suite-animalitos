// scripts/deploy_render.js - Automatizador de Despliegue Directo a Render
// Ejecuta push a GitHub y fuerza compilación limpia en Render con reporte en tiempo real.

const https = require('https');
const { execSync } = require('child_process');

const SERVICE_ID = 'srv-db0ni8lg1s2s73esfjng';
const API_KEY = 'rnd_vxTzXEhN0NeqQA49Lmzkg5zKffjn';

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function renderApi(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: `/v1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🚀 [DEPLOY RENDER] Iniciando sincronización y despliegue a OnRender...');

  // 1. Verificar estado de Git
  console.log('📦 Verificando cambios en Git...');
  const currentBranch = runCmd('git rev-parse --abbrev-ref HEAD') || 'main';
  const gitStatus = runCmd('git status --porcelain');

  // Si hay argumentos pasados, hacer commit automático
  const commitMsg = process.argv.slice(2).join(' ') || '';
  if (commitMsg && gitStatus) {
    console.log(`📝 Creando commit: "${commitMsg}"...`);
    runCmd('git add .');
    runCmd(`git commit -m "${commitMsg}"`);
  }

  // 2. Push a GitHub
  console.log(`⬆️ Enviando commits a GitHub (${currentBranch})...`);
  try {
    execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
    console.log('✅ Push completado con éxito.');
  } catch (err) {
    console.warn('⚠️ Nota durante git push:', err.message);
  }

  // 3. Disparar Deploy en Render con limpieza de caché
  console.log('⚡ Disparando orden de compilación en Render (con clearCache)...');
  const triggerRes = await renderApi(`/services/${SERVICE_ID}/deploys`, 'POST', { clearCache: 'clear' });
  
  if (triggerRes.status !== 201 && triggerRes.status !== 200) {
    console.error('❌ Error al solicitar deploy en Render:', triggerRes);
    process.exit(1);
  }

  const deployId = triggerRes.data.id;
  const commitInfo = triggerRes.data.commit ? triggerRes.data.commit.message : 'Latest';
  console.log(`📡 Deploy ID: ${deployId}`);
  console.log(`📌 Commit: ${commitInfo}`);
  console.log('⏳ Esperando compilación y puesta en vivo...');

  // 4. Monitorear hasta que esté LIVE
  let intentos = 0;
  const maxIntentos = 40; // 40 x 5s = 200 segundos
  while (intentos < maxIntentos) {
    await new Promise(r => setTimeout(r, 5000));
    intentos++;

    const check = await renderApi(`/services/${SERVICE_ID}/deploys/${deployId}`);
    if (check.data && check.data.status) {
      const st = check.data.status;
      process.stdout.write(`   [${intentos * 5}s] Estado: ${st}\n`);

      if (st === 'live') {
        console.log('\n🎉 ¡DESPLIEGUE EXITOSO Y CONFIRMADO EN VIVO!');
        console.log('🌐 URL: https://suite-animalitos.onrender.com/');
        return;
      }
      if (st === 'build_failed' || st === 'canceled' || st === 'deactivated') {
        console.error(`\n❌ El despliegue terminó con estado: ${st}`);
        process.exit(1);
      }
    }
  }

  console.log('\n⚠️ El deploy sigue procesándose en segundo plano en Render.');
  console.log('Verifica en: https://dashboard.render.com/');
}

main().catch(err => {
  console.error('Error fatal en deploy:', err);
  process.exit(1);
});
