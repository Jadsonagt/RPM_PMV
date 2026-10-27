function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema Integrado - Rede de Proteção à Mulher')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Configuração institucional. Estes valores são definidos em Propriedades do
 * script no Google Workspace e nunca devem ser gravados no código-fonte.
 */
function obterConfiguracaoProducao() {
  const propriedades = PropertiesService.getScriptProperties();
  const configuracao = {
    dbId: String(propriedades.getProperty('RPM_DB_ID') || '').trim(),
    emailSuperUsuario: String(propriedades.getProperty('RPM_EMAIL_SUPER_USUARIO') || '').trim().toLowerCase(),
    pastaBackupId: String(propriedades.getProperty('RPM_PASTA_BACKUP_ID') || '').trim(),
    emailValidacaoBackup: String(propriedades.getProperty('RPM_EMAIL_VALIDACAO_BACKUP') || '').trim(),
    prefixoBackup: String(propriedades.getProperty('RPM_PREFIXO_BACKUP') || 'RPM_Backup_').trim()
  };

  const faltantes = [];
  if (!configuracao.dbId) faltantes.push('RPM_DB_ID');
  if (!configuracao.emailSuperUsuario) faltantes.push('RPM_EMAIL_SUPER_USUARIO');
  if (!configuracao.pastaBackupId) faltantes.push('RPM_PASTA_BACKUP_ID');
  if (!configuracao.emailValidacaoBackup) faltantes.push('RPM_EMAIL_VALIDACAO_BACKUP');
  if (faltantes.length) {
    throw new Error('Configuração institucional incompleta. Defina as propriedades do script: ' + faltantes.join(', '));
  }
  return configuracao;
}

const CABECALHOS_AJUDA_VIDEOS = [
  'ID', 'Módulo', 'Categoria', 'Título', 'Descrição',
  'Perfis permitidos', 'Setores permitidos', 'URL do vídeo', 'Status', 'Ordem'
];

const VIDEOS_AJUDA_INICIAIS_RPM = [
  ['rpm-primeiro-acesso', 'RPM', 'Primeiro acesso', 'Primeiro acesso e troca de senha', 'Como entrar na plataforma e definir uma senha pessoal.', 'TODOS', 'TODOS', '', 'EM_PREPARACAO', 10],
  ['rpm-navegacao', 'RPM', 'Visão geral', 'Navegação na Rede de Proteção à Mulher', 'Conheça as áreas do RPM e as responsabilidades de uso.', 'TODOS', 'TODOS', '', 'EM_PREPARACAO', 20],
  ['rpm-prontuario', 'RPM', 'Prontuários', 'Consulta e atualização de prontuário', 'Como localizar, consultar e atualizar informações de forma responsável.', 'TODOS', 'TODOS', '', 'EM_PREPARACAO', 30],
  ['rpm-atendimento', 'RPM', 'Atendimentos', 'Registro de acolhimento e atendimento', 'Como registrar atendimentos, encaminhamentos e evoluções.', 'TODOS', 'TODOS', '', 'EM_PREPARACAO', 40],
  ['rpm-painel', 'RPM', 'Painel gerencial', 'Painel, filtros e relatórios', 'Leitura de indicadores e geração de relatórios do RPM.', 'ADMIN,TI,GESTOR,OBSERVADOR,DESENVOLVIMENTO', 'TODOS', '', 'EM_PREPARACAO', 50],
  ['rpm-controle-social', 'RPM', 'Controle social', 'Acompanhamento e controle social', 'Uso do acompanhamento conforme as permissões do perfil.', 'ADMIN,GESTOR,OBSERVADOR/CONTROLE SOCIAL,DESENVOLVIMENTO', 'TODOS', '', 'EM_PREPARACAO', 60],
  ['rpm-administracao', 'RPM', 'Administração', 'Gestão de usuários, setores e formulários', 'Administração institucional do sistema e cuidados de segurança.', 'ADMIN,TI,DESENVOLVIMENTO', 'TODOS', '', 'EM_PREPARACAO', 70]
];

function inicializarAbaAjudaVideos() {
  const db = conectarBanco();
  let aba = db.getSheetByName('AJUDA_VIDEOS');
  if (!aba) aba = db.insertSheet('AJUDA_VIDEOS');
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, CABECALHOS_AJUDA_VIDEOS.length).setValues([CABECALHOS_AJUDA_VIDEOS]);
    aba.getRange(2, 1, VIDEOS_AJUDA_INICIAIS_RPM.length, CABECALHOS_AJUDA_VIDEOS.length).setValues(VIDEOS_AJUDA_INICIAIS_RPM);
    aba.setFrozenRows(1);
  }
  return aba;
}

// O mesmo vídeo publicado na Central de Ajuda é usado antes do login e no e-mail
// de credenciais. Isso evita links diferentes para uma mesma orientação.
function obterLinkVideoPrimeiroAcesso_() {
  try {
    const aba = inicializarAbaAjudaVideos();
    const dados = aba.getDataRange().getValues();
    if (dados.length < 2) return '';
    const cabecalho = dados[0];
    const indiceId = cabecalho.indexOf('ID');
    const indiceUrl = cabecalho.indexOf('URL do vídeo');
    const indiceStatus = cabecalho.indexOf('Status');
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][indiceId] || '').trim() !== 'rpm-primeiro-acesso') continue;
      const url = String(dados[i][indiceUrl] || '').trim();
      const status = String(dados[i][indiceStatus] || '').trim().toUpperCase();
      return status !== 'INATIVO' && /^https:\/\//i.test(url) ? url : '';
    }
  } catch (erro) {
    console.warn('Não foi possível obter o vídeo de primeiro acesso: ' + erro.message);
  }
  return '';
}

// Consulta pública limitada ao link do tutorial de primeiro acesso. Não expõe
// usuários, dados da rede ou outros vídeos antes da autenticação.
function obterTutorialPrimeiroAcesso() {
  return { url: obterLinkVideoPrimeiroAcesso_() };
}

function listaAjudaPermite_(valor, referencia) {
  const itens = String(valor || 'TODOS').split(',').map(function(item) {
    return item.trim().toUpperCase();
  }).filter(Boolean);
  return !itens.length || itens.indexOf('TODOS') > -1 || itens.indexOf(String(referencia || '').trim().toUpperCase()) > -1;
}

function obterVideosAjuda(tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { sucesso: false, erro: 'Sessão inválida ou expirada.', videos: [] };

    const aba = inicializarAbaAjudaVideos();
    const dados = aba.getDataRange().getValues();
    const cabecalho = dados[0];
    const indice = function(nome) { return cabecalho.indexOf(nome); };
    const perfil = nivelSessaoNormalizado(sessao).toUpperCase();
    const setor = String(sessao.setor || '').trim().toUpperCase();
    const perfilAdministrativo = ['ADMIN', 'TI', 'DESENVOLVIMENTO'].indexOf(perfil) > -1;

    const videos = dados.slice(1).map(function(linha) {
      return {
        id: String(linha[indice('ID')] || '').trim(),
        modulo: String(linha[indice('Módulo')] || '').trim(),
        categoria: String(linha[indice('Categoria')] || '').trim(),
        titulo: String(linha[indice('Título')] || '').trim(),
        descricao: String(linha[indice('Descrição')] || '').trim(),
        perfis: String(linha[indice('Perfis permitidos')] || 'TODOS').trim(),
        setores: String(linha[indice('Setores permitidos')] || 'TODOS').trim(),
        url: String(linha[indice('URL do vídeo')] || '').trim(),
        status: String(linha[indice('Status')] || 'EM_PREPARACAO').trim().toUpperCase(),
        ordem: Number(linha[indice('Ordem')]) || 999
      };
    }).map(function(video) {
      if (video.status !== 'INATIVO') video.status = video.url ? 'PUBLICADO' : 'EM_PREPARACAO';
      return video;
    }).filter(function(video) {
      if (!video.id || video.status === 'INATIVO') return false;
      // Administradores atuam transversalmente na plataforma RP e, por isso,
      // visualizam materiais de todos os módulos presentes e futuros.
      if (perfilAdministrativo) return true;
      if (video.modulo.toUpperCase() !== 'RPM') return false;
      return listaAjudaPermite_(video.perfis, perfil) && listaAjudaPermite_(video.setores, setor);
    }).sort(function(a, b) { return a.ordem - b.ordem; });

    return { sucesso: true, videos: videos };
  } catch (erro) {
    return { sucesso: false, erro: 'Não foi possível carregar a Central de Ajuda: ' + erro.message, videos: [] };
  }
}

function podeGerenciarVideosAjuda_(sessao) {
  return ['admin', 'ti', 'desenvolvimento'].indexOf(nivelSessaoNormalizado(sessao)) > -1;
}

function mapearVideoAjuda_(linha, cabecalho) {
  const indice = function(nome) { return cabecalho.indexOf(nome); };
  const url = String(linha[indice('URL do vídeo')] || '').trim();
  const statusArmazenado = String(linha[indice('Status')] || '').trim().toUpperCase();
  return {
    id: String(linha[indice('ID')] || '').trim(),
    modulo: String(linha[indice('Módulo')] || '').trim(),
    categoria: String(linha[indice('Categoria')] || '').trim(),
    titulo: String(linha[indice('Título')] || '').trim(),
    descricao: String(linha[indice('Descrição')] || '').trim(),
    perfis: String(linha[indice('Perfis permitidos')] || 'TODOS').trim(),
    setores: String(linha[indice('Setores permitidos')] || 'TODOS').trim(),
    url: url,
    status: statusArmazenado === 'INATIVO' ? 'INATIVO' : (url ? 'PUBLICADO' : 'EM_PREPARACAO'),
    ordem: Number(linha[indice('Ordem')]) || 999
  };
}

function listarVideosAjudaParaGestao(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || !podeGerenciarVideosAjuda_(sessao)) return { sucesso: false, erro: 'Acesso negado.', videos: [] };
  const aba = inicializarAbaAjudaVideos();
  const dados = aba.getDataRange().getValues();
  const videos = dados.slice(1).map(function(linha) {
    return mapearVideoAjuda_(linha, dados[0]);
  }).filter(function(video) { return video.id; }).sort(function(a, b) { return a.ordem - b.ordem; });
  return { sucesso: true, videos: videos, opcoes: opcoesGestaoVideos_() };
}

function opcoesGestaoVideos_() {
  const perfis = ['Usuario', 'Gestor', 'Observador/Controle Social', 'Observador', 'Desenvolvimento', 'Admin', 'TI'];
  const setores = listarSetoresBase().filter(function(item) {
    return String(item.status || 'Ativo').toLowerCase() !== 'inativo';
  }).map(function(item) { return item.setor; }).sort();
  return { perfis: perfis, setores: setores };
}

function salvarVideoAjuda(dadosVideo, tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || !podeGerenciarVideosAjuda_(sessao)) return { sucesso: false, erro: 'Acesso negado.' };
  const titulo = String(dadosVideo && dadosVideo.titulo || '').trim();
  const url = String(dadosVideo && dadosVideo.url || '').trim();
  const status = url ? 'PUBLICADO' : 'EM_PREPARACAO';
  if (!titulo) return { sucesso: false, erro: 'Informe o título do vídeo.' };
  if (['EM_PREPARACAO', 'PUBLICADO', 'INATIVO'].indexOf(status) === -1) return { sucesso: false, erro: 'Status inválido.' };
  if (url && !/^https:\/\//i.test(url)) return { sucesso: false, erro: 'Use uma URL segura iniciada em https://.' };
  if (status === 'PUBLICADO' && !url) return { sucesso: false, erro: 'Informe a URL antes de publicar o vídeo.' };

  const aba = inicializarAbaAjudaVideos();
  const dados = aba.getDataRange().getValues();
  const cabecalho = dados[0];
  const idInformado = String(dadosVideo.id || '').trim();
  const id = idInformado || 'rpm-' + Utilities.getUuid();
  const linha = [
    id,
    'RPM',
    String(dadosVideo.categoria || 'Geral').trim(),
    titulo,
    String(dadosVideo.descricao || '').trim(),
    String(dadosVideo.perfis || 'TODOS').trim() || 'TODOS',
    String(dadosVideo.setores || 'TODOS').trim() || 'TODOS',
    url,
    status,
    999
  ];
  const indiceId = cabecalho.indexOf('ID');
  const registros = dados.slice(1).filter(function(registro) { return String(registro[indiceId] || '').trim() && String(registro[indiceId] || '').trim() !== id; });
  const existente = dados.slice(1).some(function(registro) { return String(registro[indiceId] || '').trim() === id; });
  registros.sort(function(a, b) { return (Number(a[cabecalho.indexOf('Ordem')]) || 999) - (Number(b[cabecalho.indexOf('Ordem')]) || 999); });
  const posicao = String(dadosVideo.posicao || 'FINAL');
  let indiceInsercao = registros.length;
  if (posicao === 'INICIO') indiceInsercao = 0;
  else if (posicao.indexOf('APOS:') === 0) {
    const referencia = posicao.substring(5);
    const indiceReferencia = registros.findIndex(function(registro) { return String(registro[indiceId] || '').trim() === referencia; });
    if (indiceReferencia > -1) indiceInsercao = indiceReferencia + 1;
  }
  registros.splice(indiceInsercao, 0, linha);
  const indiceOrdem = cabecalho.indexOf('Ordem');
  registros.forEach(function(registro, indice) { registro[indiceOrdem] = (indice + 1) * 10; });
  if (aba.getLastRow() > 1) aba.getRange(2, 1, aba.getLastRow() - 1, cabecalho.length).clearContent();
  aba.getRange(2, 1, registros.length, cabecalho.length).setValues(registros);
  registrarAuditoria(sessao, existente ? 'EDICAO_VIDEO_AJUDA' : 'CRIACAO_VIDEO_AJUDA', status, id);
  return { sucesso: true, id: id };
}

function alterarAtivacaoVideoAjuda(idVideo, inativar, tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || !podeGerenciarVideosAjuda_(sessao)) return { sucesso: false, erro: 'Acesso negado.' };
  const aba = inicializarAbaAjudaVideos();
  const dados = aba.getDataRange().getValues();
  const cabecalho = dados[0];
  const indiceId = cabecalho.indexOf('ID');
  const indiceUrl = cabecalho.indexOf('URL do vídeo');
  const indiceStatus = cabecalho.indexOf('Status');
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][indiceId] || '').trim() !== String(idVideo || '').trim()) continue;
    const novoStatus = inativar ? 'INATIVO' : (String(dados[i][indiceUrl] || '').trim() ? 'PUBLICADO' : 'EM_PREPARACAO');
    aba.getRange(i + 1, indiceStatus + 1).setValue(novoStatus);
    registrarAuditoria(sessao, inativar ? 'INATIVACAO_VIDEO_AJUDA' : 'REATIVACAO_VIDEO_AJUDA', novoStatus, idVideo);
    return { sucesso: true, status: novoStatus };
  }
  return { sucesso: false, erro: 'Vídeo não encontrado.' };
}

function obterPastaVideosAjuda(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || !podeGerenciarVideosAjuda_(sessao)) return { sucesso: false, erro: 'Acesso negado.' };
  const pastaId = String(PropertiesService.getScriptProperties().getProperty('RPM_PASTA_VIDEOS_ID') || '').trim();
  if (!pastaId) return { sucesso: true, configurada: false };
  try {
    const pasta = DriveApp.getFolderById(pastaId);
    return { sucesso: true, configurada: true, url: pasta.getUrl(), nome: pasta.getName() };
  } catch (erro) {
    return { sucesso: false, erro: 'A pasta de vídeos configurada não está acessível.' };
  }
}

/**
 * Inicializa uma base institucional vazia sem alterar abas que já contenham
 * dados. Execute somente uma vez, pelo editor Apps Script e com a conta
 * definida em RPM_EMAIL_SUPER_USUARIO.
 */
function inicializarBaseProducaoVazia() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) {
    throw new Error('Somente o super usuário institucional pode inicializar a base.');
  }

  const bloqueio = LockService.getScriptLock();
  if (!bloqueio.tryLock(30000)) throw new Error('Já existe uma inicialização em andamento.');

  try {
    const configuracao = obterConfiguracaoProducao();
    const db = conectarBanco();
    const garantirAba = function(nome, cabecalhos) {
      let aba = db.getSheetByName(nome);
      if (!aba) aba = db.insertSheet(nome);
      if (aba.getLastRow() === 0) aba.appendRow(cabecalhos);
      return aba;
    };

    const abaUsuarios = garantirAba('USUARIOS', [
      'Email', 'Nome', 'Setor/Órgão', 'Nível de Acesso', 'Senha', 'Troca de Senha Obrigatória'
    ]);
    const abaAtendimentos = garantirAba('ATENDIMENTOS', [
      'ID_Atendimento', 'ID_Vitima', 'Data do Atendimento', 'Órgão de Origem', 'CPF',
      'n_bopm', 'visita_solidaria_pm', 'n_bopc', 'medida_protetiva', 'n_bo_gcm',
      'botao_do_panico', 'grupo_de_acolhimento', 'encaminhado_casa_da_mulher',
      'avaliacao_psiquiatrica', 'atendimento_familiar', 'encaminhado_creas', 'acao_status'
    ]);
    garantirAba('VÍTIMAS', [
      'ID_Vitima', 'Data de Cadastro', 'Nome', 'Nome Social', 'Preferência de Exibição',
      'CPF', 'RG', 'Data de Nascimento', 'Idade', 'Raça/Cor', 'Telefone Fixo',
      'Celular / WhatsApp', 'CEP', 'Logradouro', 'Número', 'Bairro', 'Escolaridade',
      'Renda Familiar', 'Possui Benefício Social', 'Bolsa Família', 'BPC',
      'Aluguel Social Municipal', 'Aluguel Social Estadual', 'Outro Benefício Social',
      'Descrição de Outro Benefício Social', 'Moradia'
    ]);
    garantirAba('COMPOSICAO_FAMILIAR', [
      'ID_Composição', 'ID_Vitima', 'CPF Responsável', 'Nome Filho', 'Idade Filho',
      'Escola', 'Data de Cadastro', 'Registrado Por', 'Setor de Origem'
    ]);
    garantirAba('AUDITORIA', [
      'Data/Hora', 'E-mail', 'Nome', 'Setor', 'Perfil', 'Ação', 'Resultado', 'Identificador protegido'
    ]);

    inicializarAbaSetores();
    inicializarAbaFormulariosConfig();
    inicializarEstruturaModularRPM();

    const usuarios = abaUsuarios.getDataRange().getValues();
    const existeSuperUsuario = usuarios.slice(1).some(function(linha) {
      return String(linha[0] || '').trim().toLowerCase() === configuracao.emailSuperUsuario;
    });
    let senhaTemporaria = '';
    let avisoEnviado = false;
    if (!existeSuperUsuario) {
      senhaTemporaria = gerarSenhaTemporaria();
      abaUsuarios.appendRow([
        configuracao.emailSuperUsuario,
        'Administrador institucional',
        'TI',
        'Admin',
        criarCredencialSenha(senhaTemporaria),
        'SIM'
      ]);
      try {
        enviarAvisoAcesso(configuracao.emailSuperUsuario, 'Administrador institucional', 'criada', senhaTemporaria);
        avisoEnviado = true;
      } catch (erroEmail) {
        console.error('A estrutura foi criada, mas o e-mail da senha temporária falhou: ' + erroEmail.message);
      }
    }

    abaAtendimentos.setFrozenRows(1);
    abaUsuarios.setFrozenRows(1);
    registrarAuditoria({
      email: configuracao.emailSuperUsuario,
      nome: 'Inicialização institucional',
      setor: 'TI',
      nivelAcesso: 'Admin'
    }, 'INICIALIZACAO_BASE_PRODUCAO', existeSuperUsuario ? 'ESTRUTURA_CONFERIDA' : 'ESTRUTURA_CRIADA', '');

    return {
      sucesso: true,
      mensagem: existeSuperUsuario
        ? 'Estrutura conferida. O super usuário já estava cadastrado.'
        : avisoEnviado
          ? 'Estrutura criada e senha temporária enviada ao super usuário.'
          : 'Estrutura criada. Guarde a senha temporária retornada e verifique a autorização de e-mail.',
      senhaTemporaria: senhaTemporaria || undefined,
      avisoEnviado: avisoEnviado
    };
  } finally {
    bloqueio.releaseLock();
  }
}

// Catálogo inicial de linhas de proteção. O RPM permanece ativo; os demais
// módulos ficam preparados para ativação após a definição dos fluxos pelo GDTI.
const CATALOGO_MODULOS_PROTECAO_RPM = [
  { id: 'RPM', nome: 'Rede de Proteção à Mulher', status: 'Ativo' },
  { id: 'RPCA', nome: 'Rede de Proteção à Criança e ao Adolescente', status: 'Inativo' },
  { id: 'RPI', nome: 'Rede de Proteção à Pessoa Idosa', status: 'Inativo' },
  { id: 'RPD', nome: 'Rede de Proteção à Pessoa com Deficiência', status: 'Inativo' }
];

// Órgãos que poderão atuar em cada módulo quando ele for ativado. O vínculo
// não libera o módulo por si só; o status do módulo continua prevalecendo.
const VINCULOS_ORGAOS_MODULOS_RPM = [
  ['PM', 'RPM'], ['PM', 'RPCA'], ['PM', 'RPI'], ['PM', 'RPD'],
  ['GCM', 'RPM'], ['GCM', 'RPCA'], ['GCM', 'RPI'], ['GCM', 'RPD'],
  ['Polícia Civil', 'RPM'], ['Polícia Civil', 'RPCA'], ['Polícia Civil', 'RPI'], ['Polícia Civil', 'RPD'],
  ['Saúde', 'RPM'], ['Saúde', 'RPCA'], ['Saúde', 'RPI'], ['Saúde', 'RPD'],
  ['CREAS', 'RPM'], ['CREAS', 'RPCA'], ['CREAS', 'RPI'], ['CREAS', 'RPD'],
  ['Casa da Mulher', 'RPM'], ['CRAS', 'RPM'],
  ['Conselho Tutelar', 'RPCA'], ['Escola', 'RPCA'],
  ['Casa do Idoso', 'RPI']
];

function inicializarEstruturaModularRPM() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) throw new Error('Somente o super usuario pode inicializar a estrutura modular.');

  const db = conectarBanco();
  let abaModulos = db.getSheetByName('MODULOS_PROTECAO');
  if (!abaModulos) abaModulos = db.insertSheet('MODULOS_PROTECAO');
  if (abaModulos.getLastRow() === 0) abaModulos.appendRow(['ID_Módulo', 'Nome do Módulo', 'Status']);

  const dadosModulos = abaModulos.getDataRange().getValues();
  const idsModulos = {};
  for (let i = 1; i < dadosModulos.length; i++) idsModulos[String(dadosModulos[i][0] || '').trim().toUpperCase()] = i + 1;
  CATALOGO_MODULOS_PROTECAO_RPM.forEach(function(modulo) {
    const linha = idsModulos[modulo.id];
    if (linha) {
      abaModulos.getRange(linha, 2, 1, 2).setValues([[modulo.nome, modulo.status]]);
    } else {
      abaModulos.appendRow([modulo.id, modulo.nome, modulo.status]);
    }
  });

  let abaVinculos = db.getSheetByName('ORGAOS_MODULOS');
  if (!abaVinculos) abaVinculos = db.insertSheet('ORGAOS_MODULOS');
  if (abaVinculos.getLastRow() === 0) abaVinculos.appendRow(['Órgão', 'ID_Módulo', 'Status']);

  const dadosVinculos = abaVinculos.getDataRange().getValues();
  const chavesVinculos = {};
  for (let i = 1; i < dadosVinculos.length; i++) {
    chavesVinculos[String(dadosVinculos[i][0] || '').trim().toLowerCase() + '|' + String(dadosVinculos[i][1] || '').trim().toUpperCase()] = true;
  }
  VINCULOS_ORGAOS_MODULOS_RPM.forEach(function(vinculo) {
    const chave = vinculo[0].toLowerCase() + '|' + vinculo[1];
    if (!chavesVinculos[chave]) {
      abaVinculos.appendRow([vinculo[0], vinculo[1], 'Ativo']);
      chavesVinculos[chave] = true;
    }
  });

  return { sucesso: true, modulos: CATALOGO_MODULOS_PROTECAO_RPM.length, vinculos: VINCULOS_ORGAOS_MODULOS_RPM.length };
}

function obterCatalogoModulosProtecao(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao) return { sucesso: false, erro: 'Sessao invalida ou expirada.' };
  return { sucesso: true, modulos: CATALOGO_MODULOS_PROTECAO_RPM.map(function(modulo) {
    return { id: modulo.id, nome: modulo.nome, status: modulo.status };
  }) };
}

function criarBackupManualRPM(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || !verificarAdministradorCritico(tokenSessao)) {
    return { sucesso: false, erro: 'Acesso negado: somente administradores podem gerar backups.' };
  }

  const bloqueio = LockService.getScriptLock();
  if (!bloqueio.tryLock(30000)) {
    return { sucesso: false, erro: 'Já existe um backup em andamento. Aguarde alguns instantes e tente novamente.' };
  }

  try {
    const configuracao = obterConfiguracaoProducao();
    const agora = new Date();
    const carimbo = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    const nomeArquivo = configuracao.prefixoBackup + carimbo;
    const arquivoBanco = DriveApp.getFileById(configuracao.dbId);
    const pastaDestino = DriveApp.getFolderById(configuracao.pastaBackupId);
    const copia = arquivoBanco.makeCopy(nomeArquivo, pastaDestino);
    copia.setDescription('Cópia de segurança do RP Votorantim criada em ' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '.');

    const dataFormatada = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const resultadoEmail = enviarConfirmacaoBackupRPM(nomeArquivo, dataFormatada, copia.getUrl());
    registrarAuditoria(sessao, 'BACKUP_MANUAL', resultadoEmail.enviado ? 'SUCESSO_EMAIL_ENVIADO' : 'SUCESSO_EMAIL_NAO_ENVIADO', copia.getId());
    return {
      sucesso: true,
      nomeArquivo: nomeArquivo,
      data: dataFormatada,
      link: copia.getUrl(),
      emailEnviado: resultadoEmail.enviado,
      erroEmail: resultadoEmail.erro || ''
    };
  } catch (erro) {
    registrarAuditoria(sessao, 'BACKUP_MANUAL', 'ERRO', '');
    return { sucesso: false, erro: 'Não foi possível criar o backup: ' + erro.message };
  } finally {
    bloqueio.releaseLock();
  }
}

function criarBackupAutomaticoRPM() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) {
    throw new Error('Backup automatico nao autorizado para esta conta.');
  }

  const bloqueio = LockService.getScriptLock();
  if (!bloqueio.tryLock(30000)) {
    throw new Error('Ja existe um backup em andamento.');
  }

  const sessaoAuditoria = {
    email: emailExecutor,
    nome: 'Backup automatico',
    setor: 'SISTEMA',
    nivelAcesso: 'Admin'
  };

  try {
    const configuracao = obterConfiguracaoProducao();
    const agora = new Date();
    const carimbo = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    const nomeArquivo = configuracao.prefixoBackup + carimbo;
    const arquivoBanco = DriveApp.getFileById(configuracao.dbId);
    const pastaDestino = DriveApp.getFolderById(configuracao.pastaBackupId);
    const copia = arquivoBanco.makeCopy(nomeArquivo, pastaDestino);
    copia.setDescription('Copia automatica de seguranca do RP Votorantim criada em ' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '.');

    const dataFormatada = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const resultadoEmail = enviarConfirmacaoBackupRPM(nomeArquivo, dataFormatada, copia.getUrl());
    registrarAuditoria(sessaoAuditoria, 'BACKUP_AUTOMATICO', resultadoEmail.enviado ? 'SUCESSO_EMAIL_ENVIADO' : 'SUCESSO_EMAIL_NAO_ENVIADO', copia.getId());
    return { sucesso: true, nomeArquivo: nomeArquivo, link: copia.getUrl(), emailEnviado: resultadoEmail.enviado };
  } catch (erro) {
    registrarAuditoria(sessaoAuditoria, 'BACKUP_AUTOMATICO', 'ERRO', '');
    try {
      MailApp.sendEmail(
        obterConfiguracaoProducao().emailValidacaoBackup,
        'Rede de Protecao - falha no backup automatico',
        'Nao foi possivel criar o backup automatico do RPM. Detalhes: ' + (erro.message || String(erro))
      );
    } catch (erroEmail) {
      console.error('Falha ao enviar alerta de backup: ' + erroEmail.message);
    }
    throw erro;
  } finally {
    bloqueio.releaseLock();
  }
}

function configurarBackupAutomaticoRPM() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) {
    throw new Error('Somente o super usuario pode configurar o backup automatico.');
  }

  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    if (gatilho.getHandlerFunction() === 'criarBackupAutomaticoRPM') {
      ScriptApp.deleteTrigger(gatilho);
    }
  });

  ScriptApp.newTrigger('criarBackupAutomaticoRPM')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  return { sucesso: true, mensagem: 'Backup automatico diario configurado para aproximadamente 2h.' };
}

function enviarConfirmacaoBackupRPM(nomeArquivo, dataFormatada, linkArquivo) {
  try {
    const cota = MailApp.getRemainingDailyQuota();
    if (cota < 1) return { enviado: false, erro: 'A cota diária de envio de e-mails do Google foi atingida.' };
    const corpo = 'Backup do RPM concluído com sucesso em ' + dataFormatada + '.\n\nArquivo: ' + nomeArquivo + '\nLink: ' + linkArquivo + '\n\nEsta mensagem não contém dados de vítimas.';
    const arquivoSeguro = escaparHtmlEmail(nomeArquivo);
    const linkSeguro = escaparHtmlEmail(linkArquivo);
    const corpoHtml =
      '<div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#17365d;">' +
        '<table role="presentation" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(25,53,88,.12);">' +
          '<tr><td style="padding:22px 32px;background:#0d3b72;color:#ffffff;">' +
            '<table role="presentation" style="width:100%;border-collapse:collapse;"><tr>' +
              '<td style="vertical-align:middle;"><div style="font-size:22px;font-weight:700;">Rede de Proteção</div><div style="margin-top:5px;font-size:13px;opacity:.86;">Sistema Integrado da Rede de Proteção</div></td>' +
              '<td style="width:64px;text-align:right;vertical-align:middle;"><img src="https://helpdesk.sistemas.votorantim.sp.gov.br/assets/Votorantim_Brasao-BNNOgGOF.webp" width="54" height="54" alt="Prefeitura de Votorantim" style="display:block;width:54px;height:54px;object-fit:contain;"></td>' +
            '</tr></table>' +
          '</td></tr>' +
          '<tr><td style="padding:30px 32px;">' +
            '<p style="margin:0 0 18px;font-size:16px;line-height:1.5;">Uma cópia de segurança da base do RPM foi criada com sucesso.</p>' +
            '<div style="margin:24px 0;padding:20px;background:#edf5ff;border:1px solid #b8d5f1;border-radius:10px;text-align:center;">' +
              '<div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:.8px;color:#39658f;text-transform:uppercase;">Backup concluído em</div>' +
              '<div style="font-size:20px;font-weight:700;color:#0d3b72;">' + dataFormatada + '</div>' +
              '<div style="margin-top:12px;font-size:14px;color:#39658f;word-break:break-word;">' + arquivoSeguro + '</div>' +
            '</div>' +
            '<p style="margin:0 0 18px;text-align:center;"><a href="' + linkSeguro + '" style="display:inline-block;padding:12px 18px;background:#0d6efd;color:#ffffff;text-decoration:none;border-radius:7px;font-size:14px;font-weight:700;">Abrir cópia de segurança</a></p>' +
            '<p style="margin:0;padding:14px 16px;background:#fff8e8;border-left:4px solid #e2a529;font-size:14px;line-height:1.5;color:#5b4310;">Esta mensagem não contém dados de vítimas nem arquivos anexados.</p>' +
          '</td></tr>' +
          '<tr><td style="padding:16px 32px;background:#f4f7fb;border-top:1px solid #e4eaf1;font-size:12px;color:#718096;text-align:center;">Mensagem automática — não responda a este e-mail.</td></tr>' +
        '</table>' +
      '</div>';
    MailApp.sendEmail({
      to: obterConfiguracaoProducao().emailValidacaoBackup,
      subject: 'Rede de Proteção — backup concluído',
      body: corpo,
      htmlBody: corpoHtml
    });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, erro: erro.message || String(erro) };
  }
}

function ehSuperUsuario(email) {
  return String(email || '').trim().toLowerCase() === obterConfiguracaoProducao().emailSuperUsuario;
}

function ehPerfilSomenteLeitura(sessao) {
  const nivel = String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase();
  return ['observador', 'observador/controle social'].includes(nivel);
}

function nivelSessaoNormalizado(sessao) {
  return String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase();
}

function ehPerfilDesenvolvimento(sessao) {
  return nivelSessaoNormalizado(sessao) === 'desenvolvimento';
}

function podeAcessarAdministracao(sessao) {
  if (!sessao || sessaoExigeTrocaSenha(sessao)) return false;
  if (ehSuperUsuario(sessao.email)) return true;
  return ['admin', 'ti', 'desenvolvimento'].includes(nivelSessaoNormalizado(sessao));
}

function verificarAcessoAdministracao(tokenSessao) {
  return podeAcessarAdministracao(obterSessaoValida(tokenSessao));
}

function ehPerfilObservador(sessao) {
  return String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase() === 'observador';
}

function ehPerfilControleSocial(sessao) {
  return String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase() === 'observador/controle social';
}

function podeAcessarAcompanhamentoControleSocial(sessao) {
  const nivel = String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase();
  return ['admin', 'gestor', 'observador/controle social', 'desenvolvimento'].includes(nivel);
}

function podeAcessarPainelGerencial(sessao) {
  const nivel = String(sessao && (sessao.nivelAcesso || sessao.nivel) || '').trim().toLowerCase();
  return ['admin', 'gestor', 'observador', 'desenvolvimento'].includes(nivel);
}

function sessaoExigeTrocaSenha(sessao) {
  return String(sessao && sessao.trocaSenhaObrigatoria || '').toUpperCase() === 'SIM';
}

function normalizarTituloColuna_(valor) {
  return String(valor || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function obterIndiceColunaUsuario(aba, titulo) {
  const cabecalhos = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
  const tituloNormalizado = normalizarTituloColuna_(titulo);
  let indice = cabecalhos.findIndex(function(cabecalho) {
    return normalizarTituloColuna_(cabecalho) === tituloNormalizado;
  });
  if (indice === -1) {
    indice = cabecalhos.length;
    aba.getRange(1, indice + 1).setValue(titulo);
  }
  return indice;
}

function obterEstadoTrocaSenha_(linha, cabecalhos) {
  const tituloNormalizado = normalizarTituloColuna_('Troca de Senha Obrigatoria');
  const valores = cabecalhos.map(function(cabecalho, indice) {
    return normalizarTituloColuna_(cabecalho) === tituloNormalizado
      ? String(linha[indice] || '').trim().toUpperCase()
      : '';
  }).filter(Boolean);
  // Em caso de coluna duplicada criada por versões anteriores, "NAO" prevalece
  // para não obrigar novamente quem já concluiu a troca de senha.
  if (valores.indexOf('NAO') > -1) return 'NAO';
  if (valores.indexOf('SIM') > -1) return 'SIM';
  return '';
}

/**
 * Repara bases criadas por versões que gravaram o status de troca de senha em
 * uma coluna duplicada (com ou sem acento). Não altera senhas ou perfis.
 */
function repararStatusTrocaSenhaUsuarios() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) {
    throw new Error('Somente o super usuário institucional pode reparar a base de usuários.');
  }

  const aba = conectarBanco().getSheetByName('USUARIOS');
  if (!aba || aba.getLastRow() < 2) return { sucesso: true, usuariosCorrigidos: 0 };

  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0];
  const tituloNormalizado = normalizarTituloColuna_('Troca de Senha Obrigatoria');
  const indices = cabecalhos.map(function(cabecalho, indice) {
    return normalizarTituloColuna_(cabecalho) === tituloNormalizado ? indice : -1;
  }).filter(function(indice) { return indice >= 0; });
  if (!indices.length) return { sucesso: true, usuariosCorrigidos: 0 };

  const indicePrincipal = indices[0];
  let usuariosCorrigidos = 0;
  for (let i = 1; i < dados.length; i++) {
    const estado = obterEstadoTrocaSenha_(dados[i], cabecalhos);
    if (estado && String(dados[i][indicePrincipal] || '').trim().toUpperCase() !== estado) {
      aba.getRange(i + 1, indicePrincipal + 1).setValue(estado);
      usuariosCorrigidos += 1;
    }
  }

  registrarAuditoria({
    email: emailExecutor,
    nome: 'Reparo de base',
    setor: 'TI',
    nivelAcesso: 'Admin'
  }, 'REPARO_STATUS_TROCA_SENHA', 'USUARIOS_CORRIGIDOS_' + usuariosCorrigidos, '');
  return { sucesso: true, usuariosCorrigidos: usuariosCorrigidos };
}

function gerarSenhaTemporaria() {
  const letrasMaiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letrasMinusculas = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiais = '!@#$%*';
  const todos = letrasMaiusculas + letrasMinusculas + numeros + especiais;
  let senha = letrasMaiusculas.charAt(Math.floor(Math.random() * letrasMaiusculas.length));
  senha += letrasMinusculas.charAt(Math.floor(Math.random() * letrasMinusculas.length));
  senha += numeros.charAt(Math.floor(Math.random() * numeros.length));
  senha += especiais.charAt(Math.floor(Math.random() * especiais.length));
  for (let i = 4; i < 12; i++) senha += todos.charAt(Math.floor(Math.random() * todos.length));
  return senha.split('').sort(() => Math.random() - 0.5).join('');
}

function escaparHtmlEmail(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function enviarAvisoAcesso(email, nome, assunto, senhaTemporaria) {
  const nomeSeguro = escaparHtmlEmail(nome);
  const assuntoSeguro = escaparHtmlEmail(assunto);
  const senhaSegura = escaparHtmlEmail(senhaTemporaria);
  const linkVideoPrimeiroAcesso = obterLinkVideoPrimeiroAcesso_();
  const blocoVideoTexto = linkVideoPrimeiroAcesso
    ? '\n\nPrimeiro acesso: assista ao tutorial em ' + linkVideoPrimeiroAcesso + '\n'
    : '';
  const blocoVideoHtml = linkVideoPrimeiroAcesso
    ? '<div style="margin:0 0 16px;padding:14px 16px;background:#edf5ff;border-left:4px solid #0d6efd;font-size:14px;line-height:1.5;color:#17365d;"><strong>Primeiro acesso:</strong> veja o passo a passo em <a href="' + escaparHtmlEmail(linkVideoPrimeiroAcesso) + '" style="color:#0d3b72;font-weight:700;">Assistir tutorial</a>.</div>'
    : '';
  const corpo = 'Olá, ' + (nome || '') + '.\n\n' +
    'Sua conta no Sistema Integrado da Rede de Proteção foi ' + assunto + '.\n' +
    'Senha temporária: ' + senhaTemporaria + '\n\n' +
    'Ao acessar, escolha imediatamente uma senha pessoal.' + blocoVideoTexto + '\n' +
    'Se você não reconhece esta solicitação, entre em contato com a administração do sistema.';
  const corpoHtml =
    '<div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#17365d;">' +
      '<table role="presentation" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(25,53,88,.12);">' +
        '<tr><td style="padding:22px 32px;background:#0d3b72;color:#ffffff;">' +
          '<table role="presentation" style="width:100%;border-collapse:collapse;"><tr>' +
            '<td style="vertical-align:middle;">' +
              '<div style="font-size:22px;font-weight:700;">Rede de Proteção</div>' +
              '<div style="margin-top:5px;font-size:13px;opacity:.86;">Sistema Integrado da Rede de Proteção</div>' +
            '</td>' +
            '<td style="width:64px;text-align:right;vertical-align:middle;"><img src="https://helpdesk.sistemas.votorantim.sp.gov.br/assets/Votorantim_Brasao-BNNOgGOF.webp" width="54" height="54" alt="Prefeitura de Votorantim" style="display:block;width:54px;height:54px;object-fit:contain;"></td>' +
          '</tr></table>' +
        '</td></tr>' +
        '<tr><td style="padding:30px 32px;">' +
          '<p style="margin:0 0 18px;font-size:16px;line-height:1.5;">Olá, <strong>' + nomeSeguro + '</strong>.</p>' +
          '<p style="margin:0 0 22px;font-size:16px;line-height:1.5;">Sua conta foi <strong>' + assuntoSeguro + '</strong>. Use a senha temporária abaixo para acessar a plataforma.</p>' +
          '<div style="margin:24px 0;padding:20px;background:#edf5ff;border:1px solid #b8d5f1;border-radius:10px;text-align:center;">' +
            '<div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:.8px;color:#39658f;text-transform:uppercase;">Senha temporária</div>' +
            '<div style="font-family:Consolas,Monaco,monospace;font-size:27px;font-weight:700;letter-spacing:1.5px;color:#0d3b72;word-break:break-all;">' + senhaSegura + '</div>' +
          '</div>' +
          '<p style="margin:0 0 16px;padding:14px 16px;background:#fff8e8;border-left:4px solid #e2a529;font-size:14px;line-height:1.5;color:#5b4310;">Por segurança, no primeiro acesso você deverá escolher uma senha pessoal.</p>' +
          blocoVideoHtml +
          '<p style="margin:0;font-size:13px;line-height:1.5;color:#65758a;">Se você não reconhece esta solicitação, entre em contato com a administração do sistema.</p>' +
        '</td></tr>' +
        '<tr><td style="padding:16px 32px;background:#f4f7fb;border-top:1px solid #e4eaf1;font-size:12px;color:#718096;text-align:center;">Mensagem automática — não responda a este e-mail.</td></tr>' +
      '</table>' +
    '</div>';
  MailApp.sendEmail({ to: email, subject: 'Rede de Proteção — acesso à plataforma', body: corpo, htmlBody: corpoHtml });
}

function autorizarEnvioEmail() {
  // Execute esta funcao uma vez pelo editor do Apps Script para conceder a permissao de envio.
  return { cotaRestante: MailApp.getRemainingDailyQuota() };
}

function conectarBanco() {
  return SpreadsheetApp.openById(obterConfiguracaoProducao().dbId);
}

function inicializarAbaSetores() {
  const db = conectarBanco();
  let aba = db.getSheetByName('SETORES');
  
  // Se a aba não existir, cria ela do zero
  if (!aba) {
    aba = db.insertSheet('SETORES');
  }
  
  // Se a aba está completamente vazia, popula com cabeçalho + dados padrão
  if (aba.getLastRow() === 0) {
    aba.appendRow(['Nome do Setor', 'Cor Tema', 'URL Logo', 'Campos Vinculados']);
    
    const setoresPadrao = [
      ['PM', '#0047AB', '', 'n_bopm,visita_solidaria_pm'],
      ['Polícia Civil', '#1C1C1C', '', 'n_bopc,medida_protetiva'],
      ['GCM', '#000080', '', 'n_bo_gcm,botao_do_panico'],
      ['Saúde', '#008000', '', 'avaliacao_psiquiatrica'],
      ['Casa da Mulher', '#FF69B4', '', 'grupo_de_acolhimento,encaminhado_casa_da_mulher,acao_status'],
      ['CRAS', '#FF8C00', '', 'atendimento_familiar,encaminhado_creas,acao_status'],
      ['CREAS', '#B8860B', '', 'encaminhado_creas,acao_status']
    ];
    
    setoresPadrao.forEach(row => aba.appendRow(row));
  }
  
  return aba;
}

const CACHE_SETOR_BASE_CHAVE = 'rpm:setores:base:v1';
const CACHE_SETOR_BASE_TTL_SEGUNDOS = 300;

function invalidarCacheSetoresBase() {
  CacheService.getScriptCache().remove(CACHE_SETOR_BASE_CHAVE);
}

function listarSetoresBase() {
  try {
    const cache = CacheService.getScriptCache();
    const setoresEmCache = cache.get(CACHE_SETOR_BASE_CHAVE);
    if (setoresEmCache) {
      try {
        return JSON.parse(setoresEmCache);
      } catch (erroCache) {
        cache.remove(CACHE_SETOR_BASE_CHAVE);
      }
    }

    const aba = inicializarAbaSetores();
    
    const dados = aba.getDataRange().getValues();
    if (dados.length <= 1) {
      cache.put(CACHE_SETOR_BASE_CHAVE, '[]', CACHE_SETOR_BASE_TTL_SEGUNDOS);
      return [];
    }

    let setores = [];
    const head = dados[0];
    const indexNome = head.indexOf('Nome do Setor');
    const indexCor = head.indexOf('Cor Tema');
    const indexLogo = head.indexOf('URL Logo');
    const indexCampos = head.indexOf('Campos Vinculados');

    const indexStatus = head.indexOf('Status');

    const iN = indexNome > -1 ? indexNome : 0;
    const iC = indexCor > -1 ? indexCor : 1;
    const iL = indexLogo > -1 ? indexLogo : 2;
    const iV = indexCampos > -1 ? indexCampos : 3;
    const iS = indexStatus > -1 ? indexStatus : -1;

    for (let i = 1; i < dados.length; i++) {
      if (dados[i][iN]) {
        setores.push({
          setor: String(dados[i][iN]).trim(),
          cor: dados[i][iC] ? String(dados[i][iC]).trim() : "",
          logo: dados[i][iL] ? String(dados[i][iL]).trim() : "",
          camposVinculados: dados[i][iV] ? String(dados[i][iV]).trim() : "",
          status: iS > -1 && dados[i][iS] ? String(dados[i][iS]).trim() : "Ativo"
        });
      }
    }
    cache.put(CACHE_SETOR_BASE_CHAVE, JSON.stringify(setores), CACHE_SETOR_BASE_TTL_SEGUNDOS);
    return setores;
  } catch (error) {
    return [];
  }
}

function editarSetor(dados, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const aba = inicializarAbaSetores();
    const todosOsDados = aba.getDataRange().getValues();
    const head = todosOsDados[0];
    
    const indexNome = head.indexOf('Nome do Setor') > -1 ? head.indexOf('Nome do Setor') : 0;
    const indexCor = head.indexOf('Cor Tema') > -1 ? head.indexOf('Cor Tema') : 1;
    const indexLogo = head.indexOf('URL Logo') > -1 ? head.indexOf('URL Logo') : 2;
    
    const nomeAlvo = String(dados.setorNomeAntigo).trim().toLowerCase();
    
    for (let i = 1; i < todosOsDados.length; i++) {
      if (String(todosOsDados[i][indexNome]).trim().toLowerCase() === nomeAlvo) {
        // Linha encontrada (i+1 porque o Sheets é 1-indexed)
        const linhaSheet = i + 1;
        aba.getRange(linhaSheet, indexCor + 1).setValue(dados.cor || '');
        aba.getRange(linhaSheet, indexLogo + 1).setValue(dados.logo || '');
        invalidarCacheSetoresBase();
        return { sucesso: true, mensagem: "Setor '" + dados.setorNomeAntigo + "' atualizado com sucesso!" };
      }
    }
    
    return { sucesso: false, erro: "Setor '" + dados.setorNomeAntigo + "' não foi encontrado na base." };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao editar setor: " + error.message };
  }
}

function alternarStatusSetor(setorNome, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    if (ehPerfilDesenvolvimento(sessao)) return { sucesso: false, erro: "O perfil Desenvolvimento/Homologacao nao pode desativar setores." };
    const db = conectarBanco();
    const aba = db.getSheetByName('SETORES');
    if (!aba) return { sucesso: false, erro: "Aba SETORES não encontrada." };
    const dados = aba.getDataRange().getValues();
    if(dados.length <= 1) return { sucesso: false, erro: "Base vazia." };
    
    const head = dados[0];
    let iStatus = head.indexOf('Status');
    if (iStatus === -1) {
      iStatus = head.length;
      aba.getRange(1, iStatus + 1).setValue('Status');
    }
    const indexNome = head.indexOf('Nome do Setor') > -1 ? head.indexOf('Nome do Setor') : 0;
    
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][indexNome]).trim().toLowerCase() === String(setorNome).trim().toLowerCase()) {
        const statusAtual = dados[i][iStatus] ? String(dados[i][iStatus]).trim() : 'Ativo';
        const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';
        aba.getRange(i + 1, iStatus + 1).setValue(novoStatus);
        invalidarCacheSetoresBase();
        return { sucesso: true, mensagem: `Setor marcado como ${novoStatus}!` };
      }
    }
    return { sucesso: false, erro: "Setor não encontrado para alteração." };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

const TEMPO_SESSAO_SEGUNDOS = 21600; // 6 horas; limite máximo do CacheService

function criarSessaoUsuario(usuario) {
  const tokenSessao = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const dadosSessao = {
    email: usuario.email,
    nome: usuario.nome,
    setor: usuario.setor,
    nivel: usuario.nivel,
    nivelAcesso: usuario.nivelAcesso,
    corTema: usuario.corTema,
    urlLogo: usuario.urlLogo,
    trocaSenhaObrigatoria: usuario.trocaSenhaObrigatoria || '',
    criadaEm: new Date().toISOString()
  };

  CacheService.getScriptCache().put(
    'sessao:' + tokenSessao,
    JSON.stringify(dadosSessao),
    TEMPO_SESSAO_SEGUNDOS
  );
  return tokenSessao;
}

function obterSessaoValida(tokenSessao) {
  if (!tokenSessao || typeof tokenSessao !== 'string') return null;
  const conteudo = CacheService.getScriptCache().get('sessao:' + tokenSessao);
  if (!conteudo) return null;
  try {
    return JSON.parse(conteudo);
  } catch (erro) {
    return null;
  }
}

function resumirIdentificador(valor) {
  if (!valor) return '';
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(valor).replace(/\D/g, ''), Utilities.Charset.UTF_8);
  return bytesParaHex(hash).substring(0, 16);
}

function registrarAuditoria(sessao, acao, resultado, identificador) {
  try {
    const db = conectarBanco();
    let aba = db.getSheetByName('AUDITORIA');
    if (!aba) {
      aba = db.insertSheet('AUDITORIA');
      aba.appendRow(['Data/Hora', 'E-mail', 'Nome', 'Setor', 'Perfil', 'Ação', 'Resultado', 'Identificador protegido']);
    }
    aba.appendRow([
      new Date(), sessao.email || '', sessao.nome || '', sessao.setor || '',
      sessao.nivelAcesso || sessao.nivel || '', acao, resultado, resumirIdentificador(identificador)
    ]);
  } catch (erro) {
    // Auditoria não pode impedir um atendimento em caso de indisponibilidade pontual.
  }
}

function validarSessao(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao) {
    return { autenticado: false, erro: 'Sua sessão expirou. Entre novamente.' };
  }
  return Object.assign({ autenticado: true }, sessao);
}

function encerrarSessao(tokenSessao) {
  if (tokenSessao && typeof tokenSessao === 'string') {
    CacheService.getScriptCache().remove('sessao:' + tokenSessao);
  }
  return { sucesso: true };
}

const PREFIXO_HASH_SENHA = 'v1$';
const ITERACOES_HASH_SENHA = 5000;

function bytesParaHex(bytes) {
  return bytes.map(byte => {
    const valor = byte < 0 ? byte + 256 : byte;
    return ('0' + valor.toString(16)).slice(-2);
  }).join('');
}

function gerarHashSenha(senha, salt) {
  let valor = String(senha) + ':' + salt;
  for (let i = 0; i < ITERACOES_HASH_SENHA; i++) {
    valor = bytesParaHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, valor, Utilities.Charset.UTF_8));
  }
  return PREFIXO_HASH_SENHA + salt + '$' + valor;
}

function criarCredencialSenha(senha) {
  return gerarHashSenha(senha, Utilities.getUuid());
}

function validarCredencialSenha(senhaInformada, credencialArmazenada) {
  const credencial = String(credencialArmazenada || '');
  if (credencial.indexOf(PREFIXO_HASH_SENHA) === 0) {
    const partes = credencial.split('$');
    if (partes.length !== 3) return { valida: false, migrar: false };
    return { valida: gerarHashSenha(senhaInformada, partes[1]) === credencial, migrar: false };
  }
  // Compatibilidade temporária: converte a senha antiga após o primeiro login válido.
  return { valida: credencial === String(senhaInformada), migrar: credencial === String(senhaInformada) };
}

const MAX_TENTATIVAS_LOGIN = 5;
const JANELA_FALHAS_LOGIN_SEGUNDOS = 600;
const PREFIXO_CACHE_FALHAS_LOGIN = 'rpm:login-falhas:';

function chaveFalhasLogin(email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(email || '').trim().toLowerCase(),
    Utilities.Charset.UTF_8
  );
  return PREFIXO_CACHE_FALHAS_LOGIN + bytesParaHex(digest).substring(0, 32);
}

function tentativasLoginEsgotadas(email) {
  const valor = CacheService.getScriptCache().get(chaveFalhasLogin(email));
  if (!valor) return false;
  try {
    return Number(JSON.parse(valor).contador || 0) >= MAX_TENTATIVAS_LOGIN;
  } catch (erro) {
    return false;
  }
}

function registrarFalhaLogin(email) {
  const cache = CacheService.getScriptCache();
  const chave = chaveFalhasLogin(email);
  let contador = 0;
  const valor = cache.get(chave);
  if (valor) {
    try { contador = Number(JSON.parse(valor).contador || 0); } catch (erro) { contador = 0; }
  }
  contador += 1;
  cache.put(chave, JSON.stringify({ contador: contador }), JANELA_FALHAS_LOGIN_SEGUNDOS);
}

function limparFalhasLogin(email) {
  CacheService.getScriptCache().remove(chaveFalhasLogin(email));
}

function validarLoginManual(emailDigitado, senhaDigitada) {
  try {
    if (!emailDigitado || !senhaDigitada) {
      return { autenticado: false, erro: "E-mail e Senha são obrigatórios." };
    }

    const emailNormalizado = String(emailDigitado).toLowerCase().trim();
    if (tentativasLoginEsgotadas(emailNormalizado)) {
      return { autenticado: false, erro: "Credenciais inválidas ou utilizador não encontrado." };
    }

    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    
    if (!abaUsuarios) {
      return { autenticado: false, erro: "Aba 'USUARIOS' não configurada." };
    }

    const ultimaLinhaUsuarios = abaUsuarios.getLastRow();
    const dados = ultimaLinhaUsuarios > 0
      ? abaUsuarios.getRange(1, 1, ultimaLinhaUsuarios, Math.max(abaUsuarios.getLastColumn(), 6)).getValues()
      : [];
    const cabecalhosUsuarios = dados[0] || [];
    let usuarioEncontrado = null;
    
    // Estrutura esperada: [0] Email, [1] Nome, [2] Setor/Órgão, [3] Nível de Acesso, [4] Senha
    for (let i = 1; i < dados.length; i++) {
      const emailLinha = String(dados[i][0]).toLowerCase().trim();
      if (emailLinha !== emailNormalizado) continue;
      const resultadoSenha = validarCredencialSenha(senhaDigitada, dados[i][4]);
      
      if (resultadoSenha.valida) {
        if (resultadoSenha.migrar) {
          abaUsuarios.getRange(i + 1, 5).setValue(criarCredencialSenha(senhaDigitada));
        }
        usuarioEncontrado = {
          autenticado: true,
          email: dados[i][0] ? String(dados[i][0]).trim() : '',
          nome: dados[i][1] ? String(dados[i][1]).trim() : '',
          setor: dados[i][2] ? String(dados[i][2]).trim() : '',
          nivel: dados[i][3] ? String(dados[i][3]).trim() : '',
          nivelAcesso: dados[i][3] ? String(dados[i][3]).trim() : '', // Mantido por compatibilidade
          trocaSenhaObrigatoria: obterEstadoTrocaSenha_(dados[i], cabecalhosUsuarios),
          corTema: "",
          urlLogo: ""
        };
        break;
      }
    }

    if (usuarioEncontrado) {
      if (ehSuperUsuario(usuarioEncontrado.email)) {
        usuarioEncontrado.nivel = 'Admin';
        usuarioEncontrado.nivelAcesso = 'Admin';
      }
      // PROCV nos Setores para capturar a identidade visual
      const setores = listarSetoresBase();
      const setorData = setores.find(s => s.setor.toLowerCase() === usuarioEncontrado.setor.toLowerCase());
      
      if (setorData) {
        usuarioEncontrado.corTema = setorData.cor;
        usuarioEncontrado.urlLogo = setorData.logo;
      }
      usuarioEncontrado.tokenSessao = criarSessaoUsuario(usuarioEncontrado);
      limparFalhasLogin(emailNormalizado);
      return usuarioEncontrado;
    }

    registrarFalhaLogin(emailNormalizado);
    return { autenticado: false, erro: "Credenciais inválidas ou utilizador não encontrado." };
  } catch (error) {
    return { autenticado: false, erro: "Erro interno no servidor: " + error.message };
  }
}

function alterarMinhaSenha(novaSenha, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { sucesso: false, erro: 'Sessao invalida ou expirada.' };
    if (String(novaSenha || '').length < 10) return { sucesso: false, erro: 'A nova senha deve ter pelo menos 10 caracteres.' };

    const aba = conectarBanco().getSheetByName('USUARIOS');
    if (!aba) return { sucesso: false, erro: 'Base de usuarios nao encontrada.' };
    const dados = aba.getDataRange().getValues();
    const indiceTroca = obterIndiceColunaUsuario(aba, 'Troca de Senha Obrigatoria');
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim().toLowerCase() === String(sessao.email).trim().toLowerCase()) {
        aba.getRange(i + 1, 5).setValue(criarCredencialSenha(novaSenha));
        aba.getRange(i + 1, indiceTroca + 1).setValue('NAO');
        sessao.trocaSenhaObrigatoria = 'NAO';
        CacheService.getScriptCache().put('sessao:' + tokenSessao, JSON.stringify(sessao), TEMPO_SESSAO_SEGUNDOS);
        registrarAuditoria(sessao, 'TROCA_SENHA_OBRIGATORIA', 'SUCESSO', '');
        return { sucesso: true };
      }
    }
    return { sucesso: false, erro: 'Usuario nao encontrado.' };
  } catch (erro) {
    return { sucesso: false, erro: erro.message };
  }
}

function solicitarRedefinicaoSenha(email) {
  const respostaPadrao = { sucesso: true, mensagem: 'Se houver uma conta vinculada a este e-mail, enviaremos as instruções.' };
  try {
    const emailLimpo = String(email || '').trim().toLowerCase();
    if (!emailLimpo) return respostaPadrao;
    const cache = CacheService.getScriptCache();
    const chave = 'recuperacao-senha:' + emailLimpo;
    if (cache.get(chave)) return respostaPadrao;
    cache.put(chave, '1', 300);

    const senhaTemporaria = gerarSenhaTemporaria();
    const aba = conectarBanco().getSheetByName('USUARIOS');
    if (!aba) return respostaPadrao;
    const dados = aba.getDataRange().getValues();
    const indiceTroca = obterIndiceColunaUsuario(aba, 'Troca de Senha Obrigatoria');
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim().toLowerCase() === emailLimpo) {
        aba.getRange(i + 1, 5).setValue(criarCredencialSenha(senhaTemporaria));
        aba.getRange(i + 1, indiceTroca + 1).setValue('SIM');
        enviarAvisoAcesso(emailLimpo, dados[i][1], 'redefinida', senhaTemporaria);
        return respostaPadrao;
      }
    }
  } catch (erro) {
    console.error('Falha na solicitacao de redefinicao: ' + erro.message);
  }
  return respostaPadrao;
}

function obterNomeParaExibicao(nomeRegistro, nomeSocial, preferenciaExibicao) {
  const nomeSocialInformado = String(nomeSocial || '').trim();
  return String(preferenciaExibicao || '').trim() === 'Nome social' && nomeSocialInformado
    ? nomeSocialInformado
    : (nomeRegistro || 'Não informado');
}

function cpfEhValido(cpf) {
  const numeros = String(cpf || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(numeros) || /^(\d)\1{10}$/.test(numeros)) return false;
  const calcularDigito = (base, pesoInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base.charAt(i)) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const primeiro = calcularDigito(numeros.substring(0, 9), 10);
  const segundo = calcularDigito(numeros.substring(0, 9) + primeiro, 11);
  return Number(numeros.charAt(9)) === primeiro && Number(numeros.charAt(10)) === segundo;
}

function formatarCpfComMascara(cpf) {
  const numeros = String(cpf || '').replace(/\D/g, '').substring(0, 11);
  if (numeros.length !== 11) return String(cpf || '');
  return numeros.substring(0, 3) + '.' + numeros.substring(3, 6) + '.' + numeros.substring(6, 9) + '-' + numeros.substring(9);
}

function normalizarCpfsBaseRPM() {
  const emailExecutor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ehSuperUsuario(emailExecutor)) throw new Error('Somente o super usuario pode normalizar os CPFs da base.');

  const bloqueio = LockService.getScriptLock();
  if (!bloqueio.tryLock(30000)) throw new Error('Ja existe uma alteracao de dados em andamento.');
  try {
    const db = conectarBanco();
    const alvos = [
      { nomes: ['VÍTIMAS', 'VITIMAS'], coluna: 'CPF' },
      { nomes: ['ATENDIMENTOS'], coluna: 'CPF' },
      { nomes: ['COMPOSICAO_FAMILIAR'], coluna: 'CPF Responsável' }
    ];
    let totalAtualizados = 0;
    alvos.forEach(function(alvo) {
      let aba = null;
      for (let i = 0; i < alvo.nomes.length && !aba; i++) aba = db.getSheetByName(alvo.nomes[i]);
      if (!aba || aba.getLastRow() <= 1) return;
      const ultimaColuna = aba.getLastColumn();
      const cabecalho = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0];
      const indiceCpf = cabecalho.indexOf(alvo.coluna);
      if (indiceCpf < 0) return;
      const valores = aba.getRange(2, indiceCpf + 1, aba.getLastRow() - 1, 1).getValues();
      valores.forEach(function(linha, indiceLinha) {
        const original = String(linha[0] || '');
        const normalizado = formatarCpfComMascara(original);
        if (/^\d{11}$/.test(original) && normalizado !== original) {
          aba.getRange(indiceLinha + 2, indiceCpf + 1).setValue(normalizado);
          totalAtualizados++;
        }
      });
    });
    registrarAuditoria({ email: emailExecutor, nome: 'Normalização de CPFs', setor: 'SISTEMA', nivelAcesso: 'Admin' }, 'NORMALIZACAO_CPFS', 'SUCESSO_TOTAL_' + totalAtualizados, '');
    return { sucesso: true, totalAtualizados: totalAtualizados, mensagem: 'CPFs normalizados com sucesso.' };
  } finally {
    bloqueio.releaseLock();
  }
}

function normalizarTextoParaComparacao(valor) {
  return String(valor || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function dataParaComparacao(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return partes ? partes[3] + '-' + partes[2] + '-' + partes[1] : texto;
}

function buscarVitimaPorCpf(cpf, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return null;
    if (sessaoExigeTrocaSenha(sessao)) return null;
    if (ehPerfilSomenteLeitura(sessao)) return null;
    const db = conectarBanco();
    const abaVitimas = db.getSheetByName('VÍTIMAS');
    if (!abaVitimas) return null;

    const dados = abaVitimas.getDataRange().getValues();
    if (dados.length <= 1) return null; // Só cabeçalho ou vazia
    
    const headers = dados[0];
    
    // Tentamos descobrir os índices das colunas ou usamos valores seguros
    const indexId = headers.indexOf('ID_Vitima') !== -1 ? headers.indexOf('ID_Vitima') : 0;
    const indexNome = headers.indexOf('Nome') !== -1 ? headers.indexOf('Nome') : 2;
    const indexCpf = headers.indexOf('CPF') !== -1 ? headers.indexOf('CPF') : 3;

    // Remove tudo que não for número do CPF para comparar certinho
    const cpfLimpo = String(cpf).replace(/\D/g, '');

    for (let i = 1; i < dados.length; i++) {
      const rowCpfLimpo = String(dados[i][indexCpf]).replace(/\D/g, '');
      if (rowCpfLimpo === cpfLimpo) {
        let valorNasc = headers.indexOf('Data de Nascimento') !== -1 ? dados[i][headers.indexOf('Data de Nascimento')] : '';
        if (valorNasc) {
          try {
            valorNasc = Utilities.formatDate(new Date(valorNasc), Session.getScriptTimeZone(), "yyyy-MM-dd");
          } catch(e) {
            valorNasc = '';
          }
        }
        
        const nomeRegistro = dados[i][indexNome];
        const nomeSocial = headers.indexOf('Nome Social') !== -1 ? dados[i][headers.indexOf('Nome Social')] : '';
        const preferenciaExibicao = headers.indexOf('Preferência de Exibição') !== -1 ? dados[i][headers.indexOf('Preferência de Exibição')] : '';
        const resposta = {
          idVitima: dados[i][indexId],
          nome: nomeRegistro,
          nome_social: nomeSocial,
          preferencia_exibicao: preferenciaExibicao,
          nome_exibicao: obterNomeParaExibicao(nomeRegistro, nomeSocial, preferenciaExibicao),
          rg: headers.indexOf('RG') !== -1 ? dados[i][headers.indexOf('RG')] : '',
          nascimento: valorNasc,
          idade: headers.indexOf('Idade') !== -1 ? dados[i][headers.indexOf('Idade')] : '',
          tel_fixo: headers.indexOf('Telefone Fixo') !== -1 ? dados[i][headers.indexOf('Telefone Fixo')] : '',
          tel_celular: headers.indexOf('Celular / WhatsApp') !== -1 ? dados[i][headers.indexOf('Celular / WhatsApp')] : '',
          logradouro: headers.indexOf('Logradouro') !== -1 ? dados[i][headers.indexOf('Logradouro')] : '',
          numero: headers.indexOf('Número') !== -1 ? dados[i][headers.indexOf('Número')] : '',
          cep: headers.indexOf('CEP') !== -1 ? dados[i][headers.indexOf('CEP')] : '',
          bairro: headers.indexOf('Bairro') !== -1 ? dados[i][headers.indexOf('Bairro')] : '',
          raca_cor: headers.indexOf('Raça/Cor') !== -1 ? dados[i][headers.indexOf('Raça/Cor')] : '',
          escolaridade: headers.indexOf('Escolaridade') !== -1 ? dados[i][headers.indexOf('Escolaridade')] : '',
          renda: headers.indexOf('Renda Familiar') !== -1 ? dados[i][headers.indexOf('Renda Familiar')] : '',
          possui_beneficio_social: headers.indexOf('Possui Benefício Social') !== -1 ? dados[i][headers.indexOf('Possui Benefício Social')] : '',
          bolsa_familia: headers.indexOf('Bolsa Família') !== -1 ? dados[i][headers.indexOf('Bolsa Família')] : '',
          bpc: headers.indexOf('BPC') !== -1 ? dados[i][headers.indexOf('BPC')] : '',
          aluguel_social_municipal: headers.indexOf('Aluguel Social Municipal') !== -1 ? dados[i][headers.indexOf('Aluguel Social Municipal')] : '',
          aluguel_social_estadual: headers.indexOf('Aluguel Social Estadual') !== -1 ? dados[i][headers.indexOf('Aluguel Social Estadual')] : '',
          outro_beneficio_social: headers.indexOf('Outro Benefício Social') !== -1 ? dados[i][headers.indexOf('Outro Benefício Social')] : '',
          descricao_outro_beneficio_social: headers.indexOf('Descrição de Outro Benefício Social') !== -1 ? dados[i][headers.indexOf('Descrição de Outro Benefício Social')] : '',
          moradia: headers.indexOf('Moradia') !== -1 ? dados[i][headers.indexOf('Moradia')] : ''
        };
        registrarAuditoria(sessao, 'CONSULTA_CADASTRO', 'ENCONTRADO', cpf);
        return resposta;
      }
    }
    registrarAuditoria(sessao, 'CONSULTA_CADASTRO', 'NÃO_ENCONTRADO', cpf);
    return null;
  } catch (error) {
    return null;
  }
}

function salvarAtendimento(dadosFormulario, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (sessaoExigeTrocaSenha(sessao)) return { sucesso: false, erro: 'Defina uma nova senha antes de usar o sistema.' };
    if (ehPerfilSomenteLeitura(sessao)) return { sucesso: false, erro: 'Acesso negado: este perfil permite somente consulta e nao pode incluir ou alterar dados.' };
    if (!sessao) return { sucesso: false, erro: "Sessão inválida ou expirada." };
    dadosFormulario['Órgão de Origem'] = sessao.setor;
    dadosFormulario['_usuarioLogado'] = sessao.nome || sessao.email;
    const db = conectarBanco();
    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    
    if (!abaAtend) return { sucesso: false, erro: "Aba ATENDIMENTOS não encontrada." };

    if (dadosFormulario['CPF']) {
      dadosFormulario['CPF'] = formatarCpfComMascara(dadosFormulario['CPF']);
    }

    // Garante a coluna específica quando houver contrarreferência pelo CREAS.
    let headers = abaAtend.getRange(1, 1, 1, abaAtend.getLastColumn()).getValues()[0];
    if (dadosFormulario['Destino da Contrarreferência'] && headers.indexOf('Destino da Contrarreferência') === -1) {
      abaAtend.getRange(1, headers.length + 1).setValue('Destino da Contrarreferência');
      headers = abaAtend.getRange(1, 1, 1, abaAtend.getLastColumn()).getValues()[0];
    }

    const novaLinha = new Array(headers.length).fill("");
    
    if (dadosFormulario['CPF']) {
      const respVitima = upsertVitima(dadosFormulario['CPF'], dadosFormulario, tokenSessao);
      if (!respVitima || !respVitima.sucesso) return respVitima || { sucesso: false, erro: 'Não foi possível atualizar o prontuário.' };
      if (respVitima.idVitima) {
        dadosFormulario['ID_Vitima'] = respVitima.idVitima;
        salvarComposicaoFamiliar(dadosFormulario['ID_Vitima'], dadosFormulario['CPF'], dadosFormulario['Composição Familiar'], sessao);
      }
    }

    if (!possuiInformacaoEspecificaDoSetor(dadosFormulario, sessao.setor)) {
      registrarAuditoria(sessao, 'ATUALIZACAO_CADASTRO', 'SUCESSO', dadosFormulario['CPF']);
      return { sucesso: true, tipo: 'cadastro_atualizado', mensagem: 'Cadastro atualizado sem gerar atendimento no histórico.' };
    }

    // Inserção das colunas padrão e automáticas
    const indexIdAtend = headers.indexOf('ID_Atendimento');
    const indexIdVitima = headers.indexOf('ID_Vitima');
    const indexDataAtend = headers.indexOf('Data do Atendimento');
    const indexOrgao = headers.indexOf('Órgão de Origem');

    
    if (indexIdAtend >= 0) novaLinha[indexIdAtend] = Utilities.getUuid();
    if (indexIdVitima >= 0) novaLinha[indexIdVitima] = dadosFormulario['ID_Vitima'] || 'SEM ID';
    if (indexDataAtend >= 0) {
      // Merge: data escolhida pelo usuário + hora exata do momento do registro
      const agora = new Date();
      const dataStr = dadosFormulario['data_cadastro'];
      if (dataStr && /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        // String "YYYY-MM-DD" vinda do input type="date" — adiciona hora atual
        const [ano, mes, dia] = dataStr.split('-');
        const dataComHora = new Date(Number(ano), Number(mes) - 1, Number(dia),
          agora.getHours(), agora.getMinutes(), agora.getSeconds());
        novaLinha[indexDataAtend] = dataComHora;
      } else {
        // Fallback: usa timestamp completo do momento
        novaLinha[indexDataAtend] = agora;
      }
    }
    if (indexOrgao >= 0) novaLinha[indexOrgao] = dadosFormulario['Órgão de Origem'] || 'Desconhecido';


    // Inserção dinâmica dos demais campos baseada nos "names" enviados do frontend
    Object.keys(dadosFormulario).forEach(key => {
      // Ignora chaves que já foram processadas
      if (!['ID_Vitima', 'Órgão de Origem', 'data_cadastro'].includes(key)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          novaLinha[colIndex] = dadosFormulario[key];
        }
      }
    });

    abaAtend.appendRow(novaLinha);
    registrarAuditoria(sessao, 'REGISTRO_ATENDIMENTO', 'SUCESSO', dadosFormulario['CPF']);
    return { sucesso: true, mensagem: "Atendimento gravado!" };
    
  } catch (erro) {
    return { sucesso: false, erro: erro.message };
  }
}

function salvarComposicaoFamiliar(idVitima, cpfResponsavel, composicao, sessao) {
  if (!Array.isArray(composicao) || !composicao.length) return;
  const db = conectarBanco();
  let aba = db.getSheetByName('COMPOSICAO_FAMILIAR');
  if (!aba) {
    aba = db.insertSheet('COMPOSICAO_FAMILIAR');
    aba.appendRow(['ID_Composição', 'ID_Vitima', 'CPF Responsável', 'Nome Filho', 'Idade Filho', 'Escola', 'Data de Cadastro', 'Registrado Por', 'Setor de Origem']);
  }

  const linhas = composicao.map(filho => {
    const idade = String(filho.idade || '').trim();
    if (!String(filho.nome || '').trim() || (idade && (!/^\d+$/.test(idade) || Number(idade) > 120))) {
      throw new Error('Informe o nome de cada filho e uma idade válida, quando preenchida.');
    }
    return [Utilities.getUuid(), idVitima, formatarCpfComMascara(cpfResponsavel), String(filho.nome).trim(), idade, String(filho.escola || '').trim(), new Date(), sessao.nome || sessao.email, sessao.setor || ''];
  });
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
}

function upsertVitima(cpf, dadosFormulario, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (sessaoExigeTrocaSenha(sessao)) return { sucesso: false, erro: 'Defina uma nova senha antes de usar o sistema.' };
    if (!sessao) return { sucesso: false, erro: 'Sessao invalida ou expirada.' };
    if (ehPerfilSomenteLeitura(sessao)) return { sucesso: false, erro: 'Acesso negado: este perfil permite somente consulta e nao pode incluir ou alterar dados.' };
    const db = conectarBanco();
    let abaVitimas = db.getSheetByName('VÍTIMAS');
    if (!abaVitimas) {
      abaVitimas = db.insertSheet('VÍTIMAS');
      abaVitimas.appendRow(['ID_Vitima', 'Data de Cadastro', 'Nome', 'Nome Social', 'Preferência de Exibição', 'CPF', 'RG', 'Data de Nascimento', 'Idade', 'Raça/Cor', 'Telefone Fixo', 'Celular / WhatsApp', 'CEP', 'Logradouro', 'Número', 'Bairro', 'Escolaridade', 'Renda Familiar', 'Possui Benefício Social', 'Bolsa Família', 'BPC', 'Aluguel Social Municipal', 'Aluguel Social Estadual', 'Outro Benefício Social', 'Descrição de Outro Benefício Social', 'Moradia']);
    }

    const dados = abaVitimas.getDataRange().getValues();
    const headers = dados[0] || [];
    
    // Função auxiliar para garantir que a coluna exista
    const checkCol = (colName) => {
      let idx = headers.indexOf(colName);
      if (idx === -1) {
        idx = headers.length;
        headers.push(colName);
        abaVitimas.getRange(1, idx + 1).setValue(colName);
      }
      return idx;
    };

    const iId = checkCol('ID_Vitima');
    const iData = checkCol('Data de Cadastro');
    const iNome = checkCol('Nome');
    const iNomeSocial = checkCol('Nome Social');
    const iPreferenciaExibicao = checkCol('Preferência de Exibição');
    const iCpf = checkCol('CPF');
    const iRg = checkCol('RG');
    const iNasc = checkCol('Data de Nascimento');
    const iIdade = checkCol('Idade');
    const iRacaCor = checkCol('Raça/Cor');
    const iTelFixo = checkCol('Telefone Fixo');
    const iCelular = checkCol('Celular / WhatsApp');
    const iCep = checkCol('CEP');
    const iEnd = checkCol('Logradouro');
    const iNum = checkCol('Número');
    const iBairro = checkCol('Bairro');
    const iEscola = checkCol('Escolaridade');
    const iRenda = checkCol('Renda Familiar');
    const iPossuiBeneficio = checkCol('Possui Benefício Social');
    const iBolsa = checkCol('Bolsa Família');
    const iBpc = checkCol('BPC');
    const iAluguelMunicipal = checkCol('Aluguel Social Municipal');
    const iAluguelEstadual = checkCol('Aluguel Social Estadual');
    const iOutroBeneficio = checkCol('Outro Benefício Social');
    const iDescricaoOutroBeneficio = checkCol('Descrição de Outro Benefício Social');
    const iMoradia = checkCol('Moradia');

    const cpfLimpo = String(cpf).replace(/\D/g, '');
    let rowIndex = -1;
    let idVitima = null;

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][iCpf]).replace(/\D/g, '') === cpfLimpo) {
        rowIndex = i + 1;
        idVitima = dados[i][iId];
        break;
      }
    }

    if (rowIndex === -1) {
      if (!cpfEhValido(cpfLimpo)) {
        return { sucesso: false, codigo: 'CPF_INVALIDO', erro: 'Informe um CPF válido antes de criar o prontuário.' };
      }

      if (!dadosFormulario['_confirmarPossivelDuplicidade']) {
        const nomeInformado = normalizarTextoParaComparacao(dadosFormulario['Nome']);
        const nascimentoInformado = dataParaComparacao(dadosFormulario['Data de Nascimento']);
        const celularInformado = String(dadosFormulario['Celular / WhatsApp'] || '').replace(/\D/g, '');
        const possiveisDuplicidades = [];

        if (nomeInformado) {
          for (let i = 1; i < dados.length; i++) {
            const nomeExistente = normalizarTextoParaComparacao(dados[i][iNome]);
            if (nomeExistente !== nomeInformado) continue;
            const nascimentoExistente = dataParaComparacao(dados[i][iNasc]);
            const celularExistente = String(dados[i][iCelular] || '').replace(/\D/g, '');
            const coincideNascimento = nascimentoInformado && nascimentoExistente === nascimentoInformado;
            const coincideCelular = celularInformado.length >= 8 && celularExistente === celularInformado;
            if (coincideNascimento || coincideCelular) {
              possiveisDuplicidades.push(coincideNascimento && coincideCelular ? 'nome, nascimento e telefone' : (coincideNascimento ? 'nome e nascimento' : 'nome e telefone'));
            }
          }
        }

        if (possiveisDuplicidades.length) {
          registrarAuditoria(sessao, 'ALERTA_POSSIVEL_DUPLICIDADE', possiveisDuplicidades[0], cpfLimpo);
          return {
            sucesso: false,
            codigo: 'POSSIVEL_DUPLICIDADE',
            erro: 'Há indício de prontuário já existente. Confira o CPF antes de continuar.',
            motivos: possiveisDuplicidades
          };
        }
      }
    }

    const novaLinha = rowIndex > -1 ? abaVitimas.getRange(rowIndex, 1, 1, headers.length).getValues()[0] : new Array(headers.length).fill("");
    novaLinha[iCpf] = formatarCpfComMascara(cpfLimpo);

    if (rowIndex === -1) {
      // NOVO CADASTRO: preenche campos imutáveis
      idVitima = Utilities.getUuid();
      novaLinha[iId] = idVitima;
      novaLinha[iData] = new Date();
      if (dadosFormulario['Nome']) novaLinha[iNome] = dadosFormulario['Nome'];
      if (dadosFormulario['RG']) novaLinha[iRg] = dadosFormulario['RG'];
      if (dadosFormulario['Data de Nascimento']) novaLinha[iNasc] = dadosFormulario['Data de Nascimento'];
      if (dadosFormulario['Idade']) novaLinha[iIdade] = dadosFormulario['Idade'];
    }
    // Para vítima existente, nome de registro só pode ser alterado pelo Cadastro Completo.
    if (rowIndex > -1 && dadosFormulario['_permitirAlterarNomeRegistro'] && dadosFormulario['Nome']) {
      novaLinha[iNome] = dadosFormulario['Nome'];
    }
    // RG e Data de Nascimento permanecem imutáveis pelo fluxo comum.

    if (dadosFormulario['Telefone Fixo']) novaLinha[iTelFixo] = dadosFormulario['Telefone Fixo'];
    if (dadosFormulario['Celular / WhatsApp']) novaLinha[iCelular] = dadosFormulario['Celular / WhatsApp'];
    if (dadosFormulario['CEP']) novaLinha[iCep] = dadosFormulario['CEP'];
    if (dadosFormulario['Logradouro']) novaLinha[iEnd] = dadosFormulario['Logradouro'];
    if (dadosFormulario['Número']) novaLinha[iNum] = dadosFormulario['Número'];
    if (dadosFormulario['Bairro']) novaLinha[iBairro] = dadosFormulario['Bairro'];
    // Raça/Cor é dado sensível: após o cadastro inicial, não pode ser alterada pelo fluxo comum.
    if (rowIndex === -1 && dadosFormulario['Raça/Cor']) novaLinha[iRacaCor] = dadosFormulario['Raça/Cor'];
    if (dadosFormulario['Escolaridade']) novaLinha[iEscola] = dadosFormulario['Escolaridade'];
    if (dadosFormulario['Renda Familiar']) novaLinha[iRenda] = dadosFormulario['Renda Familiar'];
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Possui Benefício Social')) novaLinha[iPossuiBeneficio] = dadosFormulario['Possui Benefício Social'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Bolsa Família')) novaLinha[iBolsa] = dadosFormulario['Bolsa Família'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'BPC')) novaLinha[iBpc] = dadosFormulario['BPC'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Aluguel Social Municipal')) novaLinha[iAluguelMunicipal] = dadosFormulario['Aluguel Social Municipal'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Aluguel Social Estadual')) novaLinha[iAluguelEstadual] = dadosFormulario['Aluguel Social Estadual'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Outro Benefício Social')) novaLinha[iOutroBeneficio] = dadosFormulario['Outro Benefício Social'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Descrição de Outro Benefício Social')) novaLinha[iDescricaoOutroBeneficio] = dadosFormulario['Descrição de Outro Benefício Social'] || '';
    if (dadosFormulario['Moradia']) novaLinha[iMoradia] = dadosFormulario['Moradia'];
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Nome Social')) novaLinha[iNomeSocial] = dadosFormulario['Nome Social'] || '';
    if (Object.prototype.hasOwnProperty.call(dadosFormulario, 'Preferência de Exibição')) novaLinha[iPreferenciaExibicao] = dadosFormulario['Preferência de Exibição'] || 'Nome de registro';

    // AUDITORIA: registra data/hora/usuário em atualizações
    if (rowIndex > -1) {
      const iAuditoria = checkCol('Última Atualização Cadastral');
      const agora = new Date();
      const dataFmt = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      const horaFmt = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'HH:mm');
      const usuario = dadosFormulario['_usuarioLogado'] || Session.getActiveUser().getEmail() || 'Desconhecido';
      novaLinha[iAuditoria] = `Atualizado em ${dataFmt} às ${horaFmt} por ${usuario}`;
    }

    if (rowIndex > -1) {
      abaVitimas.getRange(rowIndex, 1, 1, headers.length).setValues([novaLinha]);
    } else {
      abaVitimas.appendRow(novaLinha);
      if (dadosFormulario['_confirmarPossivelDuplicidade']) {
        registrarAuditoria(sessao, 'CADASTRO_COM_DUPLICIDADE_CONFIRMADA', 'USUÁRIO_CONFIRMOU', cpfLimpo);
      }
    }
    
    return { sucesso: true, idVitima: idVitima };
  } catch(e) {
    return { sucesso: false, erro: e.message };
  }
}

function consultarProntuarioIntegrado(cpfLimpo, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (sessaoExigeTrocaSenha(sessao)) return { status: 'erro', mensagem: 'Defina uma nova senha antes de usar o sistema.' };
    if (!sessao) return { status: 'erro', mensagem: 'Sessão inválida ou expirada.' };
    if (ehPerfilObservador(sessao) || ehPerfilControleSocial(sessao)) return { status: 'erro', mensagem: 'Este perfil não possui acesso à consulta operacional.' };
    const db = conectarBanco();
    
    // Obter dados do usuário para LGPD
    let setorUsuario = '';
    let nivelAcesso = '';
    
    setorUsuario = sessao.setor || '';
    nivelAcesso = String(sessao.nivelAcesso || sessao.nivel || '').toLowerCase();

    // Carrega as configurações uma única vez por consulta. Antes, cada atendimento
    // relia as abas SETORES e CONFIG_FORMULARIOS, multiplicando o tempo de resposta.
    const setoresConsulta = listarSetoresBase();
    const camposConsulta = listarCamposGlobais();
    const camposPorIdConsulta = {};
    camposConsulta.forEach(function(campo) {
      camposPorIdConsulta[String(campo.id).trim().toLowerCase()] = campo;
    });
    const camposPorSetorConsulta = {};
    setoresConsulta.forEach(function(setor) {
      const chaveSetor = String(setor.setor || '').trim().toLowerCase();
      const ids = String(setor.camposVinculados || '').split(',')
        .map(function(id) { return id.trim().toLowerCase(); })
        .filter(Boolean);
      camposPorSetorConsulta[chaveSetor] = ids.map(function(id) {
        return camposPorIdConsulta[id];
      }).filter(Boolean);
    });
    const atendimentoTemInformacaoConsulta = function(dados, setorNome, cabecalhos) {
      const campos = camposPorSetorConsulta[String(setorNome || '').trim().toLowerCase()] || [];
      return campos.some(function(campo) {
        const indice = cabecalhos.indexOf(campo.label);
        const valor = indice >= 0 ? dados[indice] : undefined;
        return valor !== undefined && valor !== null && String(valor).trim() !== '';
      });
    };

    if (!setorUsuario) return { status: 'nao_encontrado', erro: "Usuário sem setor definido na base." };

    const abaVitimas = db.getSheetByName('VÍTIMAS');
    if (!abaVitimas) return { status: 'nao_encontrado', erro: 'Aba VÍTIMAS não encontrada' };

    const dadosVitimas = abaVitimas.getDataRange().getValues();
    if (dadosVitimas.length <= 1) return { status: 'nao_encontrado', erro: 'Nenhuma vítima cadastrada' };
    
    const headV = dadosVitimas[0];
    cpfLimpo = String(cpfLimpo).replace(/\D/g, '');
    
    let vitimaEncontrada = null;
    let idVitimaTarget = null;

    for (let i = 1; i < dadosVitimas.length; i++) {
      const row = dadosVitimas[i];
      if (String(row[headV.indexOf('CPF')]).replace(/\D/g, '') === cpfLimpo) {
        idVitimaTarget = row[headV.indexOf('ID_Vitima')];
        const nomeRegistro = row[headV.indexOf('Nome')];
        const nomeSocial = headV.indexOf('Nome Social') >= 0 ? row[headV.indexOf('Nome Social')] : '';
        const preferenciaExibicao = headV.indexOf('Preferência de Exibição') >= 0 ? row[headV.indexOf('Preferência de Exibição')] : '';
        vitimaEncontrada = {
          nome: obterNomeParaExibicao(nomeRegistro, nomeSocial, preferenciaExibicao),
          idade: headV.indexOf('Idade') >= 0 ? row[headV.indexOf('Idade')] : 'N/I',
          bairro: headV.indexOf('Bairro') >= 0 ? row[headV.indexOf('Bairro')] : 'N/I',
          medidaProtetiva: 'Não solicitada' // Placeholder
        };
        break;
      }
    }

    if (!vitimaEncontrada) return { status: 'nao_encontrado' };

    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    let listaAtendimentos = [];
    
    if (abaAtend) {
      const dadosAtend = abaAtend.getDataRange().getValues();
      if (dadosAtend.length > 1) {
        const headA = dadosAtend[0];
        
        for (let i = 1; i < dadosAtend.length; i++) {
          const row = dadosAtend[i];
          if (row[headA.indexOf('ID_Vitima')] === idVitimaTarget) {
            
            const setorAtendimento = String(row[headA.indexOf('Órgão de Origem')]).trim();

            if (!atendimentoTemInformacaoConsulta(row, setorAtendimento, headA)) continue;
            
            // Avalia Medida Protetiva
            const statusMP = headA.indexOf('Medida Protetiva') >= 0 ? row[headA.indexOf('Medida Protetiva')] : '';
            if (statusMP && (statusMP === 'Solicitada' || statusMP === 'Concedida')) {
              vitimaEncontrada.medidaProtetiva = statusMP; 
            }
            
            let acaoStatus = [];
            if (headA.indexOf('N° BOPM') >= 0 && row[headA.indexOf('N° BOPM')]) acaoStatus.push('BOPM');
            if (headA.indexOf('N° BOPC') >= 0 && row[headA.indexOf('N° BOPC')]) acaoStatus.push('BOPC');
            if (headA.indexOf('N° BO GCM') >= 0 && row[headA.indexOf('N° BO GCM')]) acaoStatus.push('BO GCM');
            if (statusMP) acaoStatus.push(`MP: ${statusMP}`);
            
            let relato = headA.indexOf('Relato/Observações') >= 0 ? row[headA.indexOf('Relato/Observações')] : '';
            if (!relato && headA.indexOf('Avaliação Psiquiátrica') >= 0 && row[headA.indexOf('Avaliação Psiquiátrica')]) {
              relato = "Avaliação: " + row[headA.indexOf('Avaliação Psiquiátrica')];
            }
            
            // LGPD: Mascarar relato se não for Admin/TI e se o setor for diferente
            if (nivelAcesso !== 'admin' && nivelAcesso !== 'ti' && nivelAcesso !== 'desenvolvimento' && setorAtendimento.toLowerCase() !== setorUsuario.toLowerCase()) {
              relato = "Informação protegida por LGPD. Conteúdo restrito ao órgão emissor.";
            }

            const rawDate = row[headA.indexOf('Data do Atendimento')];
            let dataFormatada = 'Data N/I';
            if (rawDate) {
               try { dataFormatada = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"); } catch(e){}
            }

            const mesmoSetor = setorAtendimento.toLowerCase() === setorUsuario.toLowerCase();
            let detalhesDoSetor = [];
            if (mesmoSetor) {
              const camposDoSetor = camposPorSetorConsulta[setorAtendimento.toLowerCase()] || [];
              camposDoSetor.forEach(campo => {
                const indice = headA.indexOf(campo.label);
                if (indice >= 0 && row[indice] !== '' && row[indice] !== null) {
                  let valorCampo = row[indice];
                  if (campo.tipo === 'date' && valorCampo) {
                    try { valorCampo = Utilities.formatDate(new Date(valorCampo), Session.getScriptTimeZone(), 'dd/MM/yyyy'); } catch(e) {}
                  }
                  detalhesDoSetor.push({ rotulo: campo.label, valor: String(valorCampo), tipo: campo.tipo });
                }
              });
              const indiceDestinoContrarreferencia = headA.indexOf('Destino da Contrarreferência');
              if (indiceDestinoContrarreferencia >= 0 && row[indiceDestinoContrarreferencia]) {
                detalhesDoSetor.push({ rotulo: 'Destino da contrarreferência', valor: String(row[indiceDestinoContrarreferencia]), tipo: 'select' });
              }
              if (relato) detalhesDoSetor.push({ rotulo: 'Observação', valor: relato, tipo: 'textarea' });
            }

            listaAtendimentos.push({
              dataRaw: rawDate ? new Date(rawDate).getTime() : 0,
              data: dataFormatada,
              orgao: setorAtendimento || 'N/I',
              acaoStatus: acaoStatus.length > 0 ? acaoStatus.join(' | ') : 'Atendimento Padrão',
              relato: relato || 'Sem observações detalhadas',
              observacao: row[17] ? String(row[17]).trim() : "",
              detalhesDoSetor: detalhesDoSetor
            });
          }
        }
      }
    }

    listaAtendimentos.sort((a, b) => b.dataRaw - a.dataRaw);

    registrarAuditoria(sessao, 'CONSULTA_PRONTUARIO', 'ENCONTRADO', cpfLimpo);
    return { status: 'encontrado', vitima: vitimaEncontrada, historico: listaAtendimentos };

  } catch (e) {
    return { status: 'erro', mensagem: e.toString() };
  }
}

function obterAcompanhamentosControleSocial(tokenSessao, cpfFiltro) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { erro: 'Sessão inválida ou expirada.' };
    if (sessaoExigeTrocaSenha(sessao)) return { erro: 'Defina uma nova senha antes de usar o sistema.' };
    if (!podeAcessarAcompanhamentoControleSocial(sessao)) return { erro: 'Acesso negado.' };

    const setorUsuario = String(sessao.setor || '').trim();
    if (!setorUsuario) return { erro: 'Usuário sem órgão definido.' };
    const db = conectarBanco();
    const abaVitimas = db.getSheetByName('VITIMAS') || db.getSheetByName('VÍTIMAS');
    const abaAtendimentos = db.getSheetByName('ATENDIMENTOS');
    if (!abaVitimas || !abaAtendimentos) return { itens: [], setor: setorUsuario };

    const dadosVitimas = abaVitimas.getDataRange().getValues();
    const vitimas = {};
    const cpfLimpo = String(cpfFiltro || '').replace(/\D/g, '');
    if (dadosVitimas.length > 1) {
      const cabecalhoVitimas = dadosVitimas[0];
      const iId = cabecalhoVitimas.indexOf('ID_Vitima');
      const iNome = cabecalhoVitimas.indexOf('Nome');
      const iNomeSocial = cabecalhoVitimas.indexOf('Nome Social');
      const iPreferencia = cabecalhoVitimas.indexOf('Preferência de Exibição');
      const iIdade = cabecalhoVitimas.indexOf('Idade');
      const iBairro = cabecalhoVitimas.indexOf('Bairro');
      const iCpf = cabecalhoVitimas.indexOf('CPF');
      for (let i = 1; i < dadosVitimas.length; i++) {
        const id = String(dadosVitimas[i][iId] || '').trim();
        if (!id) continue;
        if (cpfLimpo && String(dadosVitimas[i][iCpf] || '').replace(/\D/g, '') !== cpfLimpo) continue;
        vitimas[id] = {
          nome: obterNomeParaExibicao(dadosVitimas[i][iNome], iNomeSocial >= 0 ? dadosVitimas[i][iNomeSocial] : '', iPreferencia >= 0 ? dadosVitimas[i][iPreferencia] : ''),
          idade: iIdade >= 0 ? dadosVitimas[i][iIdade] : '',
          bairro: iBairro >= 0 ? dadosVitimas[i][iBairro] : ''
        };
      }
    }

    const dadosAtendimentos = abaAtendimentos.getDataRange().getValues();
    if (dadosAtendimentos.length <= 1) return { itens: [], setor: setorUsuario };
    const cabecalho = dadosAtendimentos[0];
    const iIdVitima = cabecalho.indexOf('ID_Vitima');
    const iSetor = cabecalho.indexOf('Órgão de Origem');
    const iData = cabecalho.indexOf('Data do Atendimento');
    const iRelato = cabecalho.indexOf('Relato/Observações');
    const configuracaoSetor = listarSetoresBase().find(item => String(item.setor || '').trim().toLowerCase() === setorUsuario.toLowerCase());
    const idsCampos = configuracaoSetor && configuracaoSetor.camposVinculados
      ? configuracaoSetor.camposVinculados.split(',').map(id => String(id).trim().toLowerCase()) : [];
    const camposDoSetor = listarCamposGlobais().filter(campo => idsCampos.includes(String(campo.id || '').trim().toLowerCase()));
    const porVitima = {};

    for (let i = 1; i < dadosAtendimentos.length; i++) {
      const linha = dadosAtendimentos[i];
      const setorAtendimento = String(linha[iSetor] || '').trim();
      if (setorAtendimento.toLowerCase() !== setorUsuario.toLowerCase()) continue;
      if (!possuiInformacaoEspecificaDoSetor(linha, setorAtendimento, cabecalho)) continue;
      const idVitima = String(linha[iIdVitima] || '').trim();
      if (!idVitima || !vitimas[idVitima]) continue;

      const detalhes = [];
      camposDoSetor.forEach(campo => {
        const indice = cabecalho.indexOf(campo.label);
        if (indice < 0 || linha[indice] === '' || linha[indice] === null) return;
        let valor = linha[indice];
        if (campo.tipo === 'date') {
          try { valor = Utilities.formatDate(new Date(valor), Session.getScriptTimeZone(), 'dd/MM/yyyy'); } catch (erro) {}
        }
        detalhes.push({ rotulo: campo.label, valor: String(valor), tipo: campo.tipo });
      });
      const iDestino = cabecalho.indexOf('Destino da Contrarreferência');
      if (iDestino >= 0 && linha[iDestino]) detalhes.push({ rotulo: 'Destino da contrarreferência', valor: String(linha[iDestino]), tipo: 'select' });
      if (iRelato >= 0 && linha[iRelato]) detalhes.push({ rotulo: 'Observação', valor: String(linha[iRelato]), tipo: 'textarea' });

      const valorAcao = cabecalho.indexOf('Ação / Status') >= 0 ? linha[cabecalho.indexOf('Ação / Status')] : '';
      const dataRaw = linha[iData] ? new Date(linha[iData]).getTime() : 0;
      const data = dataRaw ? Utilities.formatDate(new Date(linha[iData]), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : 'Data não informada';
      const evolucao = { data: data, dataRaw: dataRaw, resumo: String(valorAcao || 'Atendimento registrado'), detalhes: detalhes };
      if (!porVitima[idVitima]) porVitima[idVitima] = { idVitima: idVitima, nome: vitimas[idVitima].nome, idade: vitimas[idVitima].idade, bairro: vitimas[idVitima].bairro, evolucoes: [] };
      porVitima[idVitima].evolucoes.push(evolucao);
    }

    const itens = Object.keys(porVitima).map(id => {
      const item = porVitima[id];
      item.evolucoes.sort((a, b) => b.dataRaw - a.dataRaw);
      item.ultimaEvolucao = item.evolucoes[0];
      item.totalEvolucoes = item.evolucoes.length;
      return item;
    }).sort((a, b) => b.ultimaEvolucao.dataRaw - a.ultimaEvolucao.dataRaw);
    registrarAuditoria(sessao, 'CONSULTA_ACOMPANHAMENTO_ORGAO', 'SUCESSO', setorUsuario);
    return { itens: itens, setor: setorUsuario };
  } catch (erro) {
    return { erro: 'Não foi possível carregar os acompanhamentos: ' + erro.message };
  }
}

function obterDadosDashboard(tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { erro: "Sessão inválida ou expirada." };
    if (!podeAcessarPainelGerencial(sessao)) return { erro: "Acesso Negado: perfil sem permissão para o Painel Gerencial." };
    const db = conectarBanco();

    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    if (!abaAtend) return { erro: "Aba ATENDIMENTOS não encontrada." };
    
    const abaVitimas = db.getSheetByName('VITIMAS') || db.getSheetByName('VÍTIMAS');
    
    // Passo 1: Construir o Dicionário de Bairros (ID_Vitima -> Bairro)
    const mapaVitimas = {};
    if (abaVitimas) {
      const dadosVitimas = abaVitimas.getDataRange().getValues();
      var perfisDashboard = montarPerfisFiltrosDashboard_(db, dadosVitimas);
      const cabecalhoVitimas = dadosVitimas[0];
      const indexIdVitimaV = Math.max(cabecalhoVitimas.indexOf('ID_Vitima'), cabecalhoVitimas.indexOf('ID_Vítima'));
      const indexBairroVitima = cabecalhoVitimas.indexOf('Bairro');
      const indexCepVitima = cabecalhoVitimas.indexOf('CEP');
      const indexLogradouroVitima = cabecalhoVitimas.indexOf('Logradouro');
      const indexNumeroVitima = cabecalhoVitimas.indexOf('Número');
      
      if (indexIdVitimaV > -1 && indexBairroVitima > -1) {
        for (let i = 1; i < dadosVitimas.length; i++) {
          let idV = dadosVitimas[i][indexIdVitimaV];
          let bairro = dadosVitimas[i][indexBairroVitima];
          if (idV) {
            mapaVitimas[String(idV).trim()] = {
              bairro: bairro ? String(bairro).trim() : '',
              endereco: [
                indexLogradouroVitima > -1 ? dadosVitimas[i][indexLogradouroVitima] : '',
                indexNumeroVitima > -1 ? dadosVitimas[i][indexNumeroVitima] : '',
                bairro,
                indexCepVitima > -1 ? dadosVitimas[i][indexCepVitima] : '',
                'Votorantim - SP'
              ].filter(Boolean).join(', ')
            };
          }
        }
      }
    }
    
    const dadosAtend = abaAtend.getDataRange().getValues();
    if (dadosAtend.length <= 1) {
      return { totalAtendimentos: 0, atendimentosPorOrgao: {}, atendimentosMensais: {}, atendimentosPorBairro: {}, dadosBrutos: [], perfis: perfisDashboard || {} };
    }
    
    const head = dadosAtend[0];
    const indexData = head.indexOf('Data do Atendimento');
    const indexOrgao = head.indexOf('Órgão de Origem');
    const indexIdVitimaAtendimento = Math.max(head.indexOf('ID_Vitima'), head.indexOf('ID_Vítima'));
    
    let totalBruto = 0;
    let setVitimasUnicas = new Set();
    let arrayDeAtendimentos = [];

    for (let i = 1; i < dadosAtend.length; i++) {
      const row = dadosAtend[i];
      totalBruto++;
      
      let orgaoRaw = row[indexOrgao] || 'Não Informado';
      let orgao = String(orgaoRaw).trim();
      
      let dataStr = row[indexData];
      let dataIsoString = null;
      if (dataStr) {
        let dateObj = new Date(dataStr);
        if (!isNaN(dateObj)) {
            dataIsoString = dateObj.toISOString();
        }
      }
      
      let idVitima = '';
      let bairroVitima = '';

      if (indexIdVitimaAtendimento > -1) {
        idVitima = row[indexIdVitimaAtendimento] ? String(row[indexIdVitimaAtendimento]).trim() : '';
        if (idVitima) {
          setVitimasUnicas.add(idVitima);
          if (mapaVitimas[idVitima]) {
            bairroVitima = mapaVitimas[idVitima].bairro;
          }
        }
      }

      arrayDeAtendimentos.push({
          data: dataIsoString,
          orgao: orgao,
          idVitima: idVitima,
          bairro: bairroVitima,
          enderecoMapa: idVitima && mapaVitimas[idVitima] ? mapaVitimas[idVitima].endereco : ''
      });
    }

    const coordenadasPorVitima = {};
    Array.from(setVitimasUnicas).forEach(function(idVitima) {
      coordenadasPorVitima[idVitima] = mapaVitimas[idVitima]
        ? geocodificarEnderecoDashboard_(idVitima, mapaVitimas[idVitima].endereco)
        : null;
    });
    arrayDeAtendimentos.forEach(function(atendimento) {
      const coordenada = coordenadasPorVitima[atendimento.idVitima];
      if (coordenada) {
        atendimento.latitude = coordenada.latitude;
        atendimento.longitude = coordenada.longitude;
      }
      delete atendimento.enderecoMapa;
    });

    return {
      totalVitimas: setVitimasUnicas.size,
      totalAtendimentos: totalBruto,
      dadosBrutos: arrayDeAtendimentos,
      perfis: perfisDashboard || {}
    };
    
  } catch (error) {
    return { erro: "Erro ao processar métricas: " + error.message };
  }
}

function montarPerfisFiltrosDashboard_(db, dados) {
  if (!dados || dados.length < 2) return {};
  const cabecalho = dados[0];
  const indiceId = Math.max(cabecalho.indexOf('ID_Vitima'), cabecalho.indexOf('ID_Vítima'));
  if (indiceId < 0) return {};
  const indiceIdade = cabecalho.indexOf('Idade');
  const indiceRaca = cabecalho.indexOf('Raça/Cor');
  const colunasBeneficios = {
    'Bolsa Família': cabecalho.indexOf('Bolsa Família'),
    'BPC': cabecalho.indexOf('BPC'),
    'Aluguel Social Municipal': cabecalho.indexOf('Aluguel Social Municipal'),
    'Aluguel Social Estadual': cabecalho.indexOf('Aluguel Social Estadual'),
    'Outro benefício social': cabecalho.indexOf('Outro Benefício Social')
  };
  const indicePossui = cabecalho.indexOf('Possui Benefício Social');
  const vitimasComFilhos = {};
  const abaComposicao = db.getSheetByName('COMPOSICAO_FAMILIAR');
  if (abaComposicao && abaComposicao.getLastRow() > 1) {
    const dadosComposicao = abaComposicao.getDataRange().getValues();
    const cabecalhoComposicao = dadosComposicao[0];
    const indiceIdVitimaComposicao = cabecalhoComposicao.indexOf('ID_Vitima');
    if (indiceIdVitimaComposicao >= 0) {
      for (let i = 1; i < dadosComposicao.length; i++) {
        const idVitimaComposicao = String(dadosComposicao[i][indiceIdVitimaComposicao] || '').trim();
        if (idVitimaComposicao) vitimasComFilhos[idVitimaComposicao] = true;
      }
    }
  }
  const perfis = {};
  for (let i = 1; i < dados.length; i++) {
    const id = dados[i][indiceId];
    if (!id) continue;
    const beneficios = Object.keys(colunasBeneficios).filter(function(nome) {
      const indice = colunasBeneficios[nome];
      return indice > -1 && String(dados[i][indice]).trim().toLowerCase() === 'sim';
    });
    if (!beneficios.length && indicePossui > -1 && String(dados[i][indicePossui]).trim().toLowerCase() === 'sim') beneficios.push('Benefício social não especificado');
    perfis[String(id).trim()] = {
      idade: indiceIdade > -1 ? Number(dados[i][indiceIdade]) || null : null,
      racaCor: indiceRaca > -1 ? String(dados[i][indiceRaca] || '').trim() : '',
      beneficios: beneficios,
      possuiFilhos: !!vitimasComFilhos[String(id).trim()]
    };
  }
  return perfis;
}

function obterPerfisFiltrosDashboard(tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!podeAcessarPainelGerencial(sessao)) return { erro: 'Acesso negado.' };
    const db = conectarBanco();
    const aba = db.getSheetByName('VITIMAS') || db.getSheetByName('VÍTIMAS');
    if (!aba) return { perfis: {} };
    const dados = aba.getDataRange().getValues();
    if (dados.length < 2) return { perfis: {} };
    const cabecalho = dados[0];
    const indiceId = Math.max(cabecalho.indexOf('ID_Vitima'), cabecalho.indexOf('ID_Vítima'));
    if (indiceId < 0) return { perfis: {} };
    const indiceIdade = cabecalho.indexOf('Idade');
    const indiceRaca = cabecalho.indexOf('Raça/Cor');
    const colunasBeneficios = {
      'Bolsa Família': cabecalho.indexOf('Bolsa Família'),
      'BPC': cabecalho.indexOf('BPC'),
      'Aluguel Social Municipal': cabecalho.indexOf('Aluguel Social Municipal'),
      'Aluguel Social Estadual': cabecalho.indexOf('Aluguel Social Estadual'),
      'Outro benefício social': cabecalho.indexOf('Outro Benefício Social')
    };
    const indicePossui = cabecalho.indexOf('Possui Benefício Social');
    const vitimasComFilhos = {};
    const abaComposicao = db.getSheetByName('COMPOSICAO_FAMILIAR');
    if (abaComposicao && abaComposicao.getLastRow() > 1) {
      const dadosComposicao = abaComposicao.getDataRange().getValues();
      const cabecalhoComposicao = dadosComposicao[0];
      const indiceIdVitimaComposicao = cabecalhoComposicao.indexOf('ID_Vitima');
      if (indiceIdVitimaComposicao >= 0) {
        for (let i = 1; i < dadosComposicao.length; i++) {
          const idVitimaComposicao = String(dadosComposicao[i][indiceIdVitimaComposicao] || '').trim();
          if (idVitimaComposicao) vitimasComFilhos[idVitimaComposicao] = true;
        }
      }
    }
    const perfis = {};
    for (let i = 1; i < dados.length; i++) {
      const id = dados[i][indiceId];
      if (!id) continue;
      const beneficios = Object.keys(colunasBeneficios).filter(function(nome) {
        const indice = colunasBeneficios[nome];
        return indice > -1 && String(dados[i][indice]).trim().toLowerCase() === 'sim';
      });
      if (!beneficios.length && indicePossui > -1 && String(dados[i][indicePossui]).trim().toLowerCase() === 'sim') beneficios.push('Benefício social não especificado');
      perfis[String(id).trim()] = {
        idade: indiceIdade > -1 ? Number(dados[i][indiceIdade]) || null : null,
        racaCor: indiceRaca > -1 ? String(dados[i][indiceRaca] || '').trim() : '',
        beneficios: beneficios,
        possuiFilhos: !!vitimasComFilhos[String(id).trim()]
      };
    }
    return { perfis: perfis };
  } catch (erro) {
    return { erro: 'Não foi possível carregar os filtros: ' + erro.message, perfis: {} };
  }
}

function geocodificarEnderecoDashboard_(idVitima, endereco) {
  if (!endereco) return null;
  const cache = CacheService.getScriptCache();
  const chave = 'dashboard-coord-' + idVitima;
  const salvo = cache.get(chave);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }

  try {
    const resultado = Maps.newGeocoder().setRegion('br').geocode(endereco);
    if (resultado.status === 'OK' && resultado.results && resultado.results.length) {
      const local = resultado.results[0].geometry.location;
      const coordenada = { latitude: local.lat, longitude: local.lng };
      cache.put(chave, JSON.stringify(coordenada), 21600);
      return coordenada;
    }
  } catch (e) {
    console.warn('Não foi possível geocodificar vítima ' + idVitima + ': ' + e.message);
  }
  return null;
}

// ---- MÓDULO DE GESTÃO DE USUÁRIOS (ADMIN) ----

function verificarAdminAbsoluto(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao) return false;
  if (sessaoExigeTrocaSenha(sessao)) return false;
  if (ehSuperUsuario(sessao.email)) return true;
  const nivel = String(sessao.nivelAcesso || sessao.nivel || '').trim().toLowerCase();
  return nivel === 'admin' || nivel === 'ti' || nivel === 'desenvolvimento';
}

function verificarAdministradorCritico(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao || sessaoExigeTrocaSenha(sessao)) return false;
  if (ehSuperUsuario(sessao.email)) return true;
  const nivel = String(sessao.nivelAcesso || sessao.nivel || '').trim().toLowerCase();
  return nivel === 'admin' || nivel === 'ti';
}

function listarUsuariosDaBase(tokenSessao) {
  try {
    if (!verificarAdminAbsoluto(tokenSessao)) return { erro: "Acesso Negado: Apenas o Administrador pode gerenciar usuários." };
    
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    let lista = [];
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][0]) { // Se a célula de e-mail não estiver vazia
        lista.push({
          email: dados[i][0],
          nome: dados[i][1],
          setor: dados[i][2],
          nivelAcesso: dados[i][3],
          superUsuario: ehSuperUsuario(dados[i][0]),
        });
      }
    }
    return { sucesso: true, usuarios: lista };
  } catch (error) {
    return { erro: "Erro ao carregar usuários: " + error.message };
  }
}

function salvarNovoUsuario(dadosUsuario, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    const emailNovo = String(dadosUsuario.email).trim().toLowerCase();
    const nivelFinal = ehSuperUsuario(emailNovo) ? 'Admin' : dadosUsuario.nivel;
    let linhaExistente = -1;
    
    // Busca se o email já existe
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim().toLowerCase() === emailNovo) {
        linhaExistente = i + 1; // +1 porque getRange é 1-indexed
        break;
      }
    }
    
    if (linhaExistente !== -1) {
      // UPDATE (Edição)
      abaUsuarios.getRange(linhaExistente, 2).setValue(dadosUsuario.nome);
      abaUsuarios.getRange(linhaExistente, 3).setValue(dadosUsuario.setor);
      abaUsuarios.getRange(linhaExistente, 4).setValue(nivelFinal);
      
      // Atualiza a senha apenas se não for vazia
      if (dadosUsuario.senha && String(dadosUsuario.senha).trim() !== "") {
        abaUsuarios.getRange(linhaExistente, 5).setValue(criarCredencialSenha(String(dadosUsuario.senha).trim()));
        return { sucesso: true, mensagem: 'Usuário editado com sucesso.', senhaTemporaria: String(dadosUsuario.senha).trim() };
      }
      return { sucesso: true, mensagem: `Usuário editado com sucesso! (Senha mantida)` };
      
    } else {
      // INSERT (Novo Usuário)
      // Se não enviou senha, gera aleatória
      const senhaFinal = gerarSenhaTemporaria();
      
      abaUsuarios.appendRow([
        emailNovo,
        dadosUsuario.nome,
        dadosUsuario.setor,
        nivelFinal,
        criarCredencialSenha(senhaFinal)
      ]);
      const linhaNova = abaUsuarios.getLastRow();
      const indiceTroca = obterIndiceColunaUsuario(abaUsuarios, 'Troca de Senha Obrigatoria');
      abaUsuarios.getRange(linhaNova, indiceTroca + 1).setValue('SIM');
      try {
        enviarAvisoAcesso(emailNovo, dadosUsuario.nome, 'criada', senhaFinal);
        return { sucesso: true, mensagem: 'Usuario cadastrado e senha temporaria enviada por e-mail.', avisoEmail: true };
      } catch (erroEmail) {
        console.error('Usuario cadastrado, mas falhou o envio de e-mail: ' + erroEmail.message);
        return { sucesso: true, mensagem: 'Usuario cadastrado, mas nao foi possivel enviar o e-mail. Verifique a autorizacao do Apps Script e tente redefinir a senha.', avisoEmail: false };
      }
    }
  } catch (error) {
    return { sucesso: false, erro: "Erro ao salvar usuário: " + error.message };
  }
}

function excluirUsuario(emailExcluir, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    if (ehPerfilDesenvolvimento(sessao)) return { sucesso: false, erro: "O perfil Desenvolvimento/Homologacao nao pode excluir usuarios." };
    
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    const emailAlvo = String(emailExcluir).trim().toLowerCase();
    if (ehSuperUsuario(emailAlvo)) return { sucesso: false, erro: 'O super usuário protegido não pode ser excluído.' };
    let linhaEncontrada = -1;
    
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim().toLowerCase() === emailAlvo) {
        linhaEncontrada = i + 1; // +1 devido à indexação começar em 1 no App Script Sheets
        break;
      }
    }
    
    if (linhaEncontrada > 0) {
      abaUsuarios.deleteRow(linhaEncontrada);
      return { sucesso: true, mensagem: "Servidor revogado da base de acesso." };
    } else {
      return { sucesso: false, erro: "E-mail não localizado na base." };
    }
    
  } catch (error) {
    return { sucesso: false, erro: "Erro ao excluir usuário: " + error.message };
  }
}

function salvarNovoSetor(dados, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const db = conectarBanco();
    const abaSetores = db.getSheetByName('SETORES');
    if (!abaSetores) return { sucesso: false, erro: "Aba SETORES não encontrada na planilha." };
    
    const dadosSheet = abaSetores.getDataRange().getValues();
    const nomeNovo = String(dados.nome).trim().toLowerCase();
    
    // Verifica duplicidade para o mesmo nome de setor
    if (dadosSheet.length > 1) {
      const indexNome = dadosSheet[0].indexOf('Nome do Setor') > -1 ? dadosSheet[0].indexOf('Nome do Setor') : 0;
      for (let i = 1; i < dadosSheet.length; i++) {
        if (String(dadosSheet[i][indexNome]).trim().toLowerCase() === nomeNovo) {
          return { sucesso: false, erro: "Este Setor já está cadastrado na base!" };
        }
      }
    }
    
    // Anexa na última linha
    abaSetores.appendRow([
      dados.nome,
      dados.cor,
      dados.logo
    ]);
    
    invalidarCacheSetoresBase();
    return { sucesso: true, mensagem: "Setor institucional cadastrado com sucesso!" };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao salvar setor: " + error.message };
  }
}

// ============================================================
// MOTOR DE FORMULÁRIOS DINÂMICOS
// ============================================================

/**
 * Garante que a aba FORMULARIOS_CONFIG exista e tenha a estrutura correta.
 * Se estiver vazia, popula com a configuração inicial baseada nos campos
 * fixos que já existem no HTML hoje.
 */
function inicializarAbaFormulariosConfig() {
  const db = conectarBanco();
  let aba = db.getSheetByName('FORMULARIOS_CONFIG');
  
  if (!aba) {
    aba = db.insertSheet('FORMULARIOS_CONFIG');
  }
  
  if (aba.getLastRow() === 0) {
    // Cabeçalho - Dicionário Global
    aba.appendRow(['ID Coluna', 'Label (Texto da Pergunta)', 'Tipo de Input', 'Opções (Lista)', 'Status']);
    
    // Seed: Dicionário Global Inicial
    const camposPadrao = [
      ['n_bopm', 'N° BOPM', 'text', '', 'Ativo'],
      ['visita_solidaria_pm', 'Visita Solidária PM', 'select', 'Sim, Não', 'Ativo'],
      ['n_bopc', 'N° BOPC', 'text', '', 'Ativo'],
      ['medida_protetiva', 'Medida Protetiva', 'select', 'Solicitada, Concedida, Negada', 'Ativo'],
      ['n_bo_gcm', 'N° BO GCM', 'text', '', 'Ativo'],
      ['botao_do_panico', 'Botão do Pânico', 'select', 'Ativo, Inativo, Acionado', 'Ativo'],
      ['grupo_de_acolhimento', 'Grupo de Acolhimento', 'select', 'Sim, Não', 'Ativo'],
      ['encaminhado_casa_da_mulher', 'Encaminhado Casa da Mulher', 'date', '', 'Ativo'],
      ['avaliacao_psiquiatrica', 'Avaliação Psiquiátrica', 'textarea', '', 'Ativo'],
      ['atendimento_familiar', 'Atendimento Familiar', 'select', 'Realizado, Pendente', 'Ativo'],
      ['encaminhado_creas', 'Encaminhado CREAS', 'select', 'Sim, Não', 'Ativo'],
      ['acao_status', 'Ação / Status', 'text', '', 'Ativo']
    ];
    
    camposPadrao.forEach(row => aba.appendRow(row));
  }
  
  return aba;
}

/**
 * Lista TODOS os campos ativos do Dicionário Global.
 */
function listarCamposGlobais() {
  try {
    const aba = inicializarAbaFormulariosConfig();
    const dados = aba.getDataRange().getValues();
    if (dados.length <= 1) return [];
    
    const head = dados[0];
    const iId = head.indexOf('ID Coluna') > -1 ? head.indexOf('ID Coluna') : 0;
    const iLabel = head.indexOf('Label (Texto da Pergunta)') > -1 ? head.indexOf('Label (Texto da Pergunta)') : 1;
    const iTipo = head.indexOf('Tipo de Input') > -1 ? head.indexOf('Tipo de Input') : 2;
    const iOpcoes = head.indexOf('Opções (Lista)') > -1 ? head.indexOf('Opções (Lista)') : 3;
    const iStatus = head.indexOf('Status') > -1 ? head.indexOf('Status') : 4;
    
    let campos = [];
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][iStatus]).trim().toLowerCase() === 'ativo') {
        campos.push({
          id: String(dados[i][iId]).trim(),
          label: String(dados[i][iLabel]).trim(),
          tipo: String(dados[i][iTipo]).trim().toLowerCase(),
          opcoes: dados[i][iOpcoes] ? String(dados[i][iOpcoes]).trim() : ""
        });
      }
    }
    return campos;
  } catch (error) {
    return [];
  }
}

/**
 * Lista todos os campos de formulário vinculados a um setor específico,
 * OU retorna todos os campos com badges caso seja Admin/TI, baseando-se no email do usuário.
 * @param {string} emailUsuario - Email do usuário logado
 */
function possuiInformacaoEspecificaDoSetor(dados, setorNome, cabecalhos) {
  const setor = listarSetoresBase().find(s =>
    String(s.setor).trim().toLowerCase() === String(setorNome || '').trim().toLowerCase()
  );
  if (!setor || !setor.camposVinculados) return false;

  const ids = setor.camposVinculados.split(',').map(id => id.trim().toLowerCase()).filter(Boolean);
  if (!ids.length) return false;

  const labels = listarCamposGlobais()
    .filter(campo => ids.includes(String(campo.id).trim().toLowerCase()))
    .map(campo => String(campo.label).trim());

  return labels.some(label => {
    const valor = cabecalhos ? dados[cabecalhos.indexOf(label)] : dados[label];
    return valor !== undefined && valor !== null && String(valor).trim() !== '';
  });
}

function buscarCamposFormulario(emailUsuario, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { status: 'erro', mensagem: 'Sessão inválida ou expirada.' };
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    // Fallback seguro de índices da estrutura atual da planilha:
    // [0] Email, [1] Nome, [2] Setor/Órgão, [3] Nível de Acesso
    const iEmail = 0;
    const iSetor = 2;
    const iPerfil = 3;
    
    let usuarioObj = null;
    let emailLimpo = String(sessao.email).trim().toLowerCase();
    
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][iEmail]).trim().toLowerCase() === emailLimpo) {
        usuarioObj = {
          setor: String(dados[i][iSetor]).trim(),
          perfil: String(dados[i][iPerfil]).trim()
        };
        break;
      }
    }

    const globais = listarCamposGlobais();
    const setores = listarSetoresBase();
    
    const ehSuperUser = usuarioObj && (
      usuarioObj.perfil.toLowerCase() === 'admin' || 
      usuarioObj.perfil.toLowerCase() === 'ti' || 
      usuarioObj.perfil.toLowerCase() === 'desenvolvimento' ||
      usuarioObj.setor.toLowerCase() === 'ti'
    );
    
    if (ehSuperUser) {
      // Ignora filtro e injeta as badges dos setores
      globais.forEach(campo => {
        let setoresDoCampo = [];
        setores.forEach(s => {
          if (s.camposVinculados && s.camposVinculados.toLowerCase().includes(campo.id.toLowerCase())) {
            setoresDoCampo.push(s.setor);
          }
        });
        if(setoresDoCampo.length > 0) {
          campo.setoresBadge = setoresDoCampo.join(', ');
        }
      });
      return globais;
    } else if (usuarioObj) {
      // Retorna apenas vinculados ao setor
      const setorObj = setores.find(s => s.setor.toLowerCase() === usuarioObj.setor.toLowerCase());
      if (!setorObj || !setorObj.camposVinculados) return [];
      
      const idsVinculados = setorObj.camposVinculados.split(',').map(id => id.trim().toLowerCase());
      return globais.filter(c => idsVinculados.includes(c.id.toLowerCase()));
    }
    return [];
  } catch (e) {
    return { status: 'erro', mensagem: e.toString() };
  }
}

/**
 * Adiciona um novo campo ao Dicionário Global.
 * Também cria a coluna correspondente na aba ATENDIMENTOS.
 * @param {Object} dados - { label, tipo }
 */
function adicionarNovoCampoFormulario(dados, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const label = String(dados.label).trim();
    const tipo = String(dados.tipo).trim().toLowerCase();
    
    if (!label || !tipo) {
      return { sucesso: false, erro: "Todos os campos (label, tipo) são obrigatórios." };
    }
    
    // Regra 1: Gerar ID amigável
    const idColuna = label
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9\s]/g, '')  
      .replace(/\s+/g, '_')          
      .replace(/_+/g, '_')           
      .replace(/^_|_$/g, '');         
    
    if (!idColuna) return { sucesso: false, erro: "Não foi possível gerar um ID válido para o label informado." };
    
    // Verifica duplicidade no Dicionário Global
    const aba = inicializarAbaFormulariosConfig();
    const dadosConfig = aba.getDataRange().getValues();
    const head = dadosConfig[0];
    const iId = head.indexOf('ID Coluna') > -1 ? head.indexOf('ID Coluna') : 0;
    
    for (let i = 1; i < dadosConfig.length; i++) {
      if (String(dadosConfig[i][iId]).trim().toLowerCase() === idColuna) {
        return { sucesso: false, erro: "Já existe um campo com esse ID ('" + idColuna + "') no Dicionário Global." };
      }
    }
    
    // Regra 2: Salvar na config
    const opcoes = (tipo === 'select' && dados.opcoes) ? String(dados.opcoes).trim() : "";
    aba.appendRow([idColuna, label, tipo, opcoes, 'Ativo']);
    
    // Regra 3: Garantir que a coluna exista na aba ATENDIMENTOS
    const db = conectarBanco();
    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    if (abaAtend) {
      const headersAtend = abaAtend.getRange(1, 1, 1, abaAtend.getLastColumn()).getValues()[0];
      if (headersAtend.indexOf(label) === -1) {
        const novaColuna = abaAtend.getLastColumn() + 1;
        abaAtend.getRange(1, novaColuna).setValue(label);
      }
    }
    
    return { sucesso: true, mensagem: "Campo '" + label + "' adicionado ao Dicionário Global com sucesso!" };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao adicionar campo: " + error.message };
  }
}

/**
 * Edita um campo do Dicionário Global.
 * @param {Object} dados - { idColuna, label, tipo, opcoes }
 */
function editarCampoGlobal(dados, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const idColuna = String(dados.idColuna).trim();
    const label = String(dados.label).trim();
    const tipo = String(dados.tipo).trim().toLowerCase();
    const opcoes = (tipo === 'select' && dados.opcoes) ? String(dados.opcoes).trim() : "";
    
    if (!idColuna || !label || !tipo) {
      return { sucesso: false, erro: "ID, label e tipo são obrigatórios." };
    }
    
    const aba = inicializarAbaFormulariosConfig();
    const sheetData = aba.getDataRange().getValues();
    const head = sheetData[0];
    
    const iId = head.indexOf('ID Coluna') > -1 ? head.indexOf('ID Coluna') : 0;
    const iLabel = head.indexOf('Label (Texto da Pergunta)') > -1 ? head.indexOf('Label (Texto da Pergunta)') : 1;
    const iTipo = head.indexOf('Tipo de Input') > -1 ? head.indexOf('Tipo de Input') : 2;
    const iOpcoes = head.indexOf('Opções (Lista)') > -1 ? head.indexOf('Opções (Lista)') : 3;
    
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][iId]).trim().toLowerCase() === idColuna.toLowerCase()) {
        const rowIndex = i + 1;
        aba.getRange(rowIndex, iLabel + 1).setValue(label);
        aba.getRange(rowIndex, iTipo + 1).setValue(tipo);
        aba.getRange(rowIndex, iOpcoes + 1).setValue(opcoes);
        
        return { sucesso: true, mensagem: "Campo atualizado com sucesso no Dicionário Global!" };
      }
    }
    
    return { sucesso: false, erro: "Campo não encontrado." };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao editar campo: " + error.message };
  }
}

/**
 * Inativa um campo do Dicionário Global.
 * @param {string} idColuna - ID do campo (Nome da Coluna)
 */
function inativarCampoFormulario(idColuna, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    if (ehPerfilDesenvolvimento(sessao)) return { sucesso: false, erro: "O perfil Desenvolvimento/Homologacao nao pode inativar campos." };
    
    const aba = inicializarAbaFormulariosConfig();
    const dados = aba.getDataRange().getValues();
    const head = dados[0];
    
    const iId = head.indexOf('ID Coluna') > -1 ? head.indexOf('ID Coluna') : 0;
    const iStatus = head.indexOf('Status') > -1 ? head.indexOf('Status') : 3;
    
    const idNorm = String(idColuna).trim().toLowerCase();
    
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][iId]).trim().toLowerCase() === idNorm) {
        aba.getRange(i + 1, iStatus + 1).setValue('Inativo');
        return { sucesso: true, mensagem: "Campo inativado no Dicionário Global." };
      }
    }
    return { sucesso: false, erro: "Campo não encontrado na configuração." };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao inativar campo: " + error.message };
  }
}

/**
 * Salva a vinculação de campos para um setor específico.
 * @param {string} setorNome - Nome exato do setor
 * @param {Array<string>} arrayDeIds - IDs dos campos selecionados
 */
function salvarCamposDoSetor(setorNome, arrayDeIds, tokenSessao) {
  try {
    if (!verificarAcessoAdministracao(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const db = conectarBanco();
    const aba = db.getSheetByName('SETORES');
    if (!aba) return { sucesso: false, erro: "Aba SETORES não encontrada." };
    
    const dados = aba.getDataRange().getValues();
    const head = dados[0];
    const indexNome = head.indexOf('Nome do Setor') > -1 ? head.indexOf('Nome do Setor') : 0;
    const indexCampos = head.indexOf('Campos Vinculados') > -1 ? head.indexOf('Campos Vinculados') : 3;
    
    const alvo = String(setorNome).trim().toLowerCase();
    const camposString = Array.isArray(arrayDeIds) ? arrayDeIds.join(',') : String(arrayDeIds);
    
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][indexNome]).trim().toLowerCase() === alvo) {
        aba.getRange(i + 1, indexCampos + 1).setValue(camposString);
        return { sucesso: true, mensagem: "Configuração do formulário para '" + setorNome + "' salva com sucesso!" };
      }
    }
    return { sucesso: false, erro: "Setor não encontrado." };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao vincular campos: " + error.message };
  }
}

function autorizarDrive() {
  const db = conectarBanco();
  DriveApp.getFileById(db.getId());
}

function salvarEdicaoCadastroVitima(dadosFormulario, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (sessaoExigeTrocaSenha(sessao)) return { sucesso: false, erro: 'Defina uma nova senha antes de usar o sistema.' };
    if (ehPerfilSomenteLeitura(sessao)) return { sucesso: false, erro: 'Acesso negado: este perfil permite somente consulta e nao pode incluir ou alterar dados.' };
    if (!sessao) return { sucesso: false, erro: 'Sessão inválida ou expirada.' };
    dadosFormulario['_usuarioLogado'] = sessao.nome || sessao.email;
    dadosFormulario['_permitirAlterarNomeRegistro'] = true;
    if (!dadosFormulario['CPF']) {
      return { sucesso: false, erro: "CPF é obrigatório para editar o cadastro." };
    }
    const resp = upsertVitima(dadosFormulario['CPF'], dadosFormulario, tokenSessao);
    if (resp.sucesso) {
      registrarAuditoria(sessao, 'EDICAO_CADASTRO_COMPLETO', 'SUCESSO', dadosFormulario['CPF']);
      return { sucesso: true, mensagem: "Cadastro da vítima atualizado com sucesso." };
    } else {
      return { sucesso: false, erro: resp.erro || "Erro ao atualizar cadastro." };
    }
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
}

function podeCorrigirCpf(sessao) {
  if (!sessao) return false;
  if (ehSuperUsuario(sessao.email)) return true;
  const nivel = String(sessao.nivelAcesso || sessao.nivel || '').trim().toLowerCase();
  return ['admin', 'ti', 'gestor', 'desenvolvimento'].includes(nivel);
}

function corrigirCpfVitima(cpfAtual, cpfNovo, motivo, tokenSessao) {
  const bloqueio = LockService.getScriptLock();
  if (!bloqueio.tryLock(30000)) {
    return { sucesso: false, erro: 'Já existe uma alteração de cadastro em andamento. Aguarde alguns instantes e tente novamente.' };
  }

  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { sucesso: false, erro: 'Sessão inválida ou expirada.' };
    if (sessaoExigeTrocaSenha(sessao)) return { sucesso: false, erro: 'Defina uma nova senha antes de usar o sistema.' };
    if (!podeCorrigirCpf(sessao)) {
      return { sucesso: false, codigo: 'ACESSO_NEGADO', erro: 'Somente Admin, TI ou Gestor podem corrigir o CPF de um prontuário.' };
    }

    const cpfAnterior = String(cpfAtual || '').replace(/\D/g, '');
    const cpfCorrigido = String(cpfNovo || '').replace(/\D/g, '');
    const justificativa = String(motivo || '').trim();

    if (cpfCorrigido.length !== 11) return { sucesso: false, codigo: 'CPF_INVALIDO', erro: 'Digite os 11 n\u00fameros do CPF. Os pontos e o h\u00edfen s\u00e3o adicionados automaticamente.' };
    if (cpfCorrigido.length === 11 && !cpfEhValido(cpfCorrigido)) return { sucesso: false, codigo: 'CPF_INVALIDO', erro: 'O CPF informado possui 11 n\u00fameros, mas os d\u00edgitos verificadores n\u00e3o conferem. Confira o documento.' };

    if (cpfAnterior.length !== 11) return { sucesso: false, codigo: 'CPF_ATUAL_INVALIDO', erro: 'Não foi possível identificar o CPF atual do prontuário.' };
    if (!cpfEhValido(cpfCorrigido)) return { sucesso: false, codigo: 'CPF_INVALIDO', erro: 'Informe um CPF válido com 11 dígitos.' };
    if (cpfAnterior === cpfCorrigido) return { sucesso: false, codigo: 'CPF_IGUAL', erro: 'O novo CPF é igual ao CPF atual.' };
    if (justificativa.length < 5) return { sucesso: false, codigo: 'MOTIVO_OBRIGATORIO', erro: 'Informe o motivo da correção.' };

    const db = conectarBanco();
    const abaVitimas = db.getSheetByName('VÍTIMAS');
    if (!abaVitimas) return { sucesso: false, erro: 'Aba de vítimas não encontrada.' };

    const dados = abaVitimas.getDataRange().getValues();
    if (dados.length <= 1) return { sucesso: false, erro: 'Nenhum prontuário cadastrado.' };
    const cabecalho = dados[0];
    const iId = cabecalho.indexOf('ID_Vitima');
    const iCpf = cabecalho.indexOf('CPF');
    if (iCpf < 0) return { sucesso: false, erro: 'A coluna CPF não foi encontrada na base.' };

    let linhaAtual = -1;
    let idVitima = '';
    let linhaCpfDestino = -1;
    for (let i = 1; i < dados.length; i++) {
      const cpfLinha = String(dados[i][iCpf] || '').replace(/\D/g, '');
      if (cpfLinha === cpfAnterior) {
        linhaAtual = i + 1;
        idVitima = iId >= 0 ? String(dados[i][iId] || '') : '';
      }
      if (cpfLinha === cpfCorrigido) linhaCpfDestino = i + 1;
    }

    if (linhaAtual < 0) return { sucesso: false, codigo: 'PRONTUARIO_NAO_ENCONTRADO', erro: 'Não foi encontrado um prontuário com o CPF informado.' };
    if (linhaCpfDestino >= 0 && linhaCpfDestino !== linhaAtual) {
      registrarAuditoria(sessao, 'CORRECAO_CPF', 'BLOQUEADA_CPF_JA_CADASTRADO', cpfAnterior + '|' + cpfCorrigido);
      return {
        sucesso: false,
        codigo: 'CPF_DESTINO_JA_CADASTRADO',
        erro: 'O CPF informado já pertence a outro prontuário. A correção foi bloqueada para evitar a mistura de históricos.',
        mensagem: 'Solicite uma revisão administrativa para avaliar a unificação dos prontuários.'
      };
    }

    abaVitimas.getRange(linhaAtual, iCpf + 1).setValue(formatarCpfComMascara(cpfCorrigido));
    registrarAuditoria(sessao, 'CORRECAO_CPF', 'SUCESSO_MOTIVO_REGISTRADO: ' + justificativa.substring(0, 180), cpfAnterior + '|' + cpfCorrigido);
    return {
      sucesso: true,
      idVitima: idVitima,
      cpfAnterior: cpfAnterior,
      cpfNovo: cpfCorrigido,
      mensagem: 'CPF corrigido com sucesso. O histórico do prontuário foi preservado.'
    };
  } catch (erro) {
    return { sucesso: false, erro: 'Não foi possível corrigir o CPF: ' + erro.message };
  } finally {
    bloqueio.releaseLock();
  }
}
