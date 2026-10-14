function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema Integrado - Rede de Proteção à Mulher')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

const DB_ID = '1XH4_zAMC6s8bIXyHv-n4WKSNOz1iafFoDlUgL7hv4Ck';

function conectarBanco() {
  return SpreadsheetApp.openById(DB_ID);
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

function listarSetoresBase() {
  try {
    const aba = inicializarAbaSetores();
    
    const dados = aba.getDataRange().getValues();
    if (dados.length <= 1) return [];

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
    return setores;
  } catch (error) {
    return [];
  }
}

function editarSetor(dados, tokenSessao) {
  try {
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
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

function validarLoginManual(emailDigitado, senhaDigitada) {
  try {
    if (!emailDigitado || !senhaDigitada) {
      return { autenticado: false, erro: "E-mail e Senha são obrigatórios." };
    }

    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    
    if (!abaUsuarios) {
      return { autenticado: false, erro: "Aba 'USUARIOS' não configurada." };
    }

    const dados = abaUsuarios.getDataRange().getValues();
    let usuarioEncontrado = null;
    
    // Estrutura esperada: [0] Email, [1] Nome, [2] Setor/Órgão, [3] Nível de Acesso, [4] Senha
    for (let i = 1; i < dados.length; i++) {
      const emailLinha = String(dados[i][0]).toLowerCase().trim();
      const resultadoSenha = validarCredencialSenha(senhaDigitada, dados[i][4]);
      
      if (emailLinha === String(emailDigitado).toLowerCase().trim() && resultadoSenha.valida) {
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
          corTema: "",
          urlLogo: ""
        };
        break;
      }
    }

    if (usuarioEncontrado) {
      // PROCV nos Setores para capturar a identidade visual
      const setores = listarSetoresBase();
      const setorData = setores.find(s => s.setor.toLowerCase() === usuarioEncontrado.setor.toLowerCase());
      
      if (setorData) {
        usuarioEncontrado.corTema = setorData.cor;
        usuarioEncontrado.urlLogo = setorData.logo;
      }
      usuarioEncontrado.tokenSessao = criarSessaoUsuario(usuarioEncontrado);
      return usuarioEncontrado;
    }

    return { autenticado: false, erro: "Credenciais inválidas ou utilizador não encontrado." };
  } catch (error) {
    return { autenticado: false, erro: "Erro interno no servidor: " + error.message };
  }
}

function buscarVitimaPorCpf(cpf, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return null;
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
        
        const resposta = {
          idVitima: dados[i][indexId],
          nome: dados[i][indexNome],
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
    if (!sessao) return { sucesso: false, erro: "Sessão inválida ou expirada." };
    dadosFormulario['Órgão de Origem'] = sessao.setor;
    dadosFormulario['_usuarioLogado'] = sessao.nome || sessao.email;
    const db = conectarBanco();
    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    
    if (!abaAtend) return { sucesso: false, erro: "Aba ATENDIMENTOS não encontrada." };

    // Pegamos a primeira linha (cabeçalho) para mapear
    const headers = abaAtend.getRange(1, 1, 1, abaAtend.getLastColumn()).getValues()[0];
    const novaLinha = new Array(headers.length).fill("");
    
    if (dadosFormulario['CPF']) {
      const respVitima = upsertVitima(dadosFormulario['CPF'], dadosFormulario);
      if (respVitima.idVitima) {
        dadosFormulario['ID_Vitima'] = respVitima.idVitima;
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

function upsertVitima(cpf, dadosFormulario) {
  try {
    const db = conectarBanco();
    let abaVitimas = db.getSheetByName('VÍTIMAS');
    if (!abaVitimas) {
      abaVitimas = db.insertSheet('VÍTIMAS');
      abaVitimas.appendRow(['ID_Vitima', 'Data de Cadastro', 'Nome', 'CPF', 'RG', 'Data de Nascimento', 'Idade', 'Raça/Cor', 'Telefone Fixo', 'Celular / WhatsApp', 'CEP', 'Logradouro', 'Número', 'Bairro', 'Escolaridade', 'Renda Familiar', 'Possui Benefício Social', 'Bolsa Família', 'BPC', 'Aluguel Social Municipal', 'Aluguel Social Estadual', 'Outro Benefício Social', 'Descrição de Outro Benefício Social', 'Moradia']);
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

    const novaLinha = rowIndex > -1 ? abaVitimas.getRange(rowIndex, 1, 1, headers.length).getValues()[0] : new Array(headers.length).fill("");

    if (rowIndex === -1) {
      // NOVO CADASTRO: preenche campos imutáveis
      idVitima = Utilities.getUuid();
      novaLinha[iId] = idVitima;
      novaLinha[iData] = new Date();
      novaLinha[iCpf] = cpf;
      if (dadosFormulario['Nome']) novaLinha[iNome] = dadosFormulario['Nome'];
      if (dadosFormulario['RG']) novaLinha[iRg] = dadosFormulario['RG'];
      if (dadosFormulario['Data de Nascimento']) novaLinha[iNasc] = dadosFormulario['Data de Nascimento'];
      if (dadosFormulario['Idade']) novaLinha[iIdade] = dadosFormulario['Idade'];
    }
    // Para vítima existente: NÃO sobrescreve Nome, RG e Data de Nascimento (campos imutáveis)

    if (dadosFormulario['Telefone Fixo']) novaLinha[iTelFixo] = dadosFormulario['Telefone Fixo'];
    if (dadosFormulario['Celular / WhatsApp']) novaLinha[iCelular] = dadosFormulario['Celular / WhatsApp'];
    if (dadosFormulario['CEP']) novaLinha[iCep] = dadosFormulario['CEP'];
    if (dadosFormulario['Logradouro']) novaLinha[iEnd] = dadosFormulario['Logradouro'];
    if (dadosFormulario['Número']) novaLinha[iNum] = dadosFormulario['Número'];
    if (dadosFormulario['Bairro']) novaLinha[iBairro] = dadosFormulario['Bairro'];
    if (dadosFormulario['Raça/Cor']) novaLinha[iRacaCor] = dadosFormulario['Raça/Cor'];
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
    }
    
    return { sucesso: true, idVitima: idVitima };
  } catch(e) {
    return { sucesso: false, erro: e.message };
  }
}

function consultarProntuarioIntegrado(cpfLimpo, tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { status: 'erro', mensagem: 'Sessão inválida ou expirada.' };
    const db = conectarBanco();
    
    // Obter dados do usuário para LGPD
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dadosUsu = abaUsuarios.getDataRange().getValues();
    let setorUsuario = '';
    let nivelAcesso = '';
    
    setorUsuario = sessao.setor || '';
    nivelAcesso = String(sessao.nivelAcesso || sessao.nivel || '').toLowerCase();

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
        vitimaEncontrada = {
          nome: row[headV.indexOf('Nome')] || 'Não informado',
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

            if (!possuiInformacaoEspecificaDoSetor(row, setorAtendimento, headA)) continue;
            
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
            if (nivelAcesso !== 'admin' && nivelAcesso !== 'ti' && setorAtendimento.toLowerCase() !== setorUsuario.toLowerCase()) {
              relato = "Informação protegida por LGPD. Conteúdo restrito ao órgão emissor.";
            }

            const rawDate = row[headA.indexOf('Data do Atendimento')];
            let dataFormatada = 'Data N/I';
            if (rawDate) {
               try { dataFormatada = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"); } catch(e){}
            }

            listaAtendimentos.push({
              dataRaw: rawDate ? new Date(rawDate).getTime() : 0,
              data: dataFormatada,
              orgao: setorAtendimento || 'N/I',
              acaoStatus: acaoStatus.length > 0 ? acaoStatus.join(' | ') : 'Atendimento Padrão',
              relato: relato || 'Sem observações detalhadas',
              observacao: row[17] ? String(row[17]).trim() : ""
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

function obterDadosDashboard(tokenSessao) {
  try {
    const sessao = obterSessaoValida(tokenSessao);
    if (!sessao) return { erro: "Sessão inválida ou expirada." };
    const db = conectarBanco();
    const nivelAcesso = String(sessao.nivelAcesso || sessao.nivel || '');
    
    // RBAC: Verificação de acesso para tela gerencial
    const niveisPermitidos = ['admin', 'diretoria', 'secretario', 'secretário'];
    if (!nivelAcesso || !niveisPermitidos.includes(nivelAcesso.toLowerCase())) {
      return { erro: "Acesso Negado: Apenas gestores podem visualizar o Dashboard Gerencial." };
    }

    const abaAtend = db.getSheetByName('ATENDIMENTOS');
    if (!abaAtend) return { erro: "Aba ATENDIMENTOS não encontrada." };
    
    const abaVitimas = db.getSheetByName('VITIMAS') || db.getSheetByName('VÍTIMAS');
    
    // Passo 1: Construir o Dicionário de Bairros (ID_Vitima -> Bairro)
    const mapaBairros = {};
    if (abaVitimas) {
      const dadosVitimas = abaVitimas.getDataRange().getValues();
      const cabecalhoVitimas = dadosVitimas[0];
      const indexIdVitimaV = Math.max(cabecalhoVitimas.indexOf('ID_Vitima'), cabecalhoVitimas.indexOf('ID_Vítima'));
      const indexBairroVitima = cabecalhoVitimas.indexOf('Bairro');
      
      if (indexIdVitimaV > -1 && indexBairroVitima > -1) {
        for (let i = 1; i < dadosVitimas.length; i++) {
          let idV = dadosVitimas[i][indexIdVitimaV];
          let bairro = dadosVitimas[i][indexBairroVitima];
          if (idV && bairro) {
            mapaBairros[idV] = String(bairro).trim();
          }
        }
      }
    }
    
    const dadosAtend = abaAtend.getDataRange().getValues();
    if (dadosAtend.length <= 1) {
      return { totalAtendimentos: 0, atendimentosPorOrgao: {}, atendimentosMensais: {}, atendimentosPorBairro: {} };
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
          if (mapaBairros[idVitima]) {
            bairroVitima = mapaBairros[idVitima];
          }
        }
      }

      arrayDeAtendimentos.push({
          data: dataIsoString,
          orgao: orgao,
          idVitima: idVitima,
          bairro: bairroVitima
      });
    }

    return {
      totalVitimas: setVitimasUnicas.size,
      totalAtendimentos: totalBruto,
      dadosBrutos: arrayDeAtendimentos
    };
    
  } catch (error) {
    return { erro: "Erro ao processar métricas: " + error.message };
  }
}

// ---- MÓDULO DE GESTÃO DE USUÁRIOS (ADMIN) ----

function verificarAdminAbsoluto(tokenSessao) {
  const sessao = obterSessaoValida(tokenSessao);
  if (!sessao) return false;
  const nivel = String(sessao.nivelAcesso || sessao.nivel || '').trim().toLowerCase();
  return nivel === 'admin' || nivel === 'ti';
  return true; // Bypass temporário para restaurar acesso geral
  const db = conectarBanco();
  const abaUsuarios = db.getSheetByName('USUARIOS');
  if (!abaUsuarios) return false;
  
  const dadosUsuarios = abaUsuarios.getDataRange().getValues();
  for (let i = 1; i < dadosUsuarios.length; i++) {
    if (String(dadosUsuarios[i][0]).toLowerCase().trim() === email.toLowerCase()) {
      const nivel = String(dadosUsuarios[i][3]).trim().toLowerCase();
      return nivel === 'admin';
    }
  }
  return false;
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    const emailNovo = String(dadosUsuario.email).trim().toLowerCase();
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
      abaUsuarios.getRange(linhaExistente, 4).setValue(dadosUsuario.nivel);
      
      // Atualiza a senha apenas se não for vazia
      if (dadosUsuario.senha && String(dadosUsuario.senha).trim() !== "") {
        abaUsuarios.getRange(linhaExistente, 5).setValue(criarCredencialSenha(String(dadosUsuario.senha).trim()));
        return { sucesso: true, mensagem: 'Usuário editado com sucesso.', senhaTemporaria: String(dadosUsuario.senha).trim() };
      }
      return { sucesso: true, mensagem: `Usuário editado com sucesso! (Senha mantida)` };
      
    } else {
      // INSERT (Novo Usuário)
      // Se não enviou senha, gera aleatória
      let senhaFinal = dadosUsuario.senha ? String(dadosUsuario.senha).trim() : '';
      if (!senhaFinal) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for(let i = 0; i < 6; i++) {
          senhaFinal += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      
      abaUsuarios.appendRow([
        emailNovo,
        dadosUsuario.nome,
        dadosUsuario.setor,
        dadosUsuario.nivel,
        criarCredencialSenha(senhaFinal)
      ]);
      
      return { sucesso: true, mensagem: 'Usuário cadastrado com sucesso.', senhaTemporaria: senhaFinal };
    }
  } catch (error) {
    return { sucesso: false, erro: "Erro ao salvar usuário: " + error.message };
  }
}

function excluirUsuario(emailExcluir, tokenSessao) {
  try {
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
    const db = conectarBanco();
    const abaUsuarios = db.getSheetByName('USUARIOS');
    const dados = abaUsuarios.getDataRange().getValues();
    
    const emailAlvo = String(emailExcluir).trim().toLowerCase();
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!verificarAdminAbsoluto(tokenSessao)) return { sucesso: false, erro: "Acesso Negado." };
    
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
    if (!sessao) return { sucesso: false, erro: 'Sessão inválida ou expirada.' };
    dadosFormulario['_usuarioLogado'] = sessao.nome || sessao.email;
    if (!dadosFormulario['CPF']) {
      return { sucesso: false, erro: "CPF é obrigatório para editar o cadastro." };
    }
    const resp = upsertVitima(dadosFormulario['CPF'], dadosFormulario);
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
