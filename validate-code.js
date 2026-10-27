const fs = require('fs');
const vm = require('vm');

const htmlFiles = fs.readdirSync('.').filter((file) => file.endsWith('.html'));
const backend = fs.readFileSync('backend.gs', 'utf8');
let failures = 0;

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

try {
  new vm.Script(backend, { filename: 'backend.gs' });
  console.log('OK: backend.gs');
} catch (error) {
  failures += 1;
  console.error(`FAIL: backend.gs - ${error.message}`);
}

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const scripts = [...source.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    try {
      new vm.Script(match[1], { filename: `${file}#script${index + 1}` });
    } catch (error) {
      failures += 1;
      console.error(`FAIL: ${file}#script${index + 1} - ${error.message}`);
    }
  });
}

const requiredBackendFunctions = [
  'doGet',
  'validarLoginManual',
  'salvarAtendimento',
  'salvarEdicaoCadastroVitima',
  'consultarProntuarioIntegrado',
  'obterAcompanhamentosControleSocial',
  'obterDadosDashboard',
  'criarBackupManualRPM',
  'criarBackupAutomaticoRPM',
  'configurarBackupAutomaticoRPM',
  'corrigirCpfVitima',
  'formatarCpfComMascara',
  'normalizarCpfsBaseRPM',
  'podeAcessarAcompanhamentoControleSocial',
  'tentativasLoginEsgotadas',
  'registrarFalhaLogin',
  'limparFalhasLogin'
];
requiredBackendFunctions.forEach((name) => {
  check(new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(backend), `função essencial ausente: ${name}`);
});

const allHtml = htmlFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
['normalizarDescricaoOutro', 'habilitarEdicaoVitima'].forEach((name) => {
  check(!new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(allHtml), `função removida reapareceu: ${name}`);
});
check(!/function\s+normalizar\s*\(/.test(fs.readFileSync('dashboard-scripts.html', 'utf8')), 'helper de dashboard removido reapareceu');
check(/const\s+ITERACOES_HASH_SENHA\s*=\s*5000\s*;/.test(backend), 'iterações do hash de senha foram alteradas');
check(!/PERF_LOGIN|_performanceLogin|MetricaLogin/.test(backend + allHtml), 'instrumentação temporária de desempenho permaneceu no código');

const ids = new Map();
for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bid=["']([^"']+)["']/g)) {
    const id = match[1];
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(file);
  }
}
for (const [id, files] of ids) {
  check(files.length === 1, `id HTML duplicado: ${id} (${files.join(', ')})`);
}

if (failures) {
  console.error(`\n${failures} validação(ões) falharam.`);
  process.exit(1);
}

console.log(`OK: ${htmlFiles.length} arquivos HTML e as invariantes essenciais foram validados.`);
