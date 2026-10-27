<div align="center">

[![📖 Página 1: Visão Geral](https://img.shields.io/badge/📖_Página_1-Visão_Geral_&_Operação-6e7781?style=for-the-badge)](README.md)
[![🏛️ Página 2: Modelo C4](https://img.shields.io/badge/🏛️_Página_2-Arquitetura_(Modelo_C4)-0969da?style=for-the-badge)](ARQUITETURA.md)

---
</div>

# Arquitetura do Sistema — Modelo C4

Especificação arquitetural formal do **Sistema Integrado da Rede de Proteção (RPM - Votorantim)**, estruturada através dos 4 níveis do **Modelo C4** (*Context, Containers, Components, Code*).

| Componente | Tecnologia | Papel no Sistema |
| --- | --- | --- |
| Interface | HTML5, CSS3 e JavaScript ES6+ | SPA servida via Apps Script HtmlService |
| Backend | Google Apps Script (`backend.gs`) | Regras de negócio, segurança e roteamento RPC |
| Base de dados | Google Sheets institucional | Armazenamento relacional estruturado em abas |
| Arquivos e backups | Google Drive institucional | Snapshots diários e persistência em Drive Compartilhado |
| Mensageria | Gmail / MailApp Service | Alertas transacionais de integridade e primeiro acesso |
| Execução | Web App Google Apps Script | Aplicação serverless restrita ao domínio institucional |

---

## 1. Contexto do Sistema (System Context)

```mermaid
flowchart TB
    classDef person fill:#08427b,stroke:#052a4f,stroke-width:2px,color:#fff;
    classDef system fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff;
    classDef external fill:#757575,stroke:#424242,stroke-width:2px,color:#fff;

    subgraph Atores["Atores Institucionais"]
        Operador["<b>Profissional da Rede</b><br/>[CREAS, CRAS, Saúde, PM, GCM, Polícia Civil, Casa da Mulher]<br/><i>Registra e consulta prontuários intersetoriais</i>"]:::person
        Gestor["<b>Administrador / Superusuário</b><br/>[GDTI / Gestão da Rede]<br/><i>Gerencia permissões, setores, esquemas e auditoria</i>"]:::person
        Fiscal["<b>Conselho / Controle Social</b><br/>[CMDCA, CMDM, Ministério Público]<br/><i>Audita métricas anonimizadas e fluxos</i>"]:::person
        Municipe["<b>Munícipe / Vítima</b><br/>[Público Alvo]<br/><i>Cidadão em situação de vulnerabilidade acolhido</i>"]:::person
    end

    subgraph FronteiraSistema["Fronteira da Aplicação"]
        RPM["<b>Sistema Integrado da Rede de Proteção</b><br/><i>[Google Apps Script / Web App]</i><br/>Centraliza prontuários, fluxos intersetoriais, painéis analíticos e auditoria rastreável"]:::system
    end

    subgraph Ecossistema["Plataforma Google Workspace Institucional (Prefeitura de Votorantim)"]
        GoogleAuth["<b>Google Workspace Identity</b><br/><i>Controle de Domínio e SSO</i>"]:::external
        GoogleSheets["<b>Google Sheets Database</b><br/><i>Armazenamento Tabular Relacional Seguro</i>"]:::external
        GoogleDrive["<b>Google Drive Compartilhado</b><br/><i>Repositório de Snapshots e Backups Frios</i>"]:::external
        GoogleMail["<b>Gmail / MailApp API</b><br/><i>Serviço Transacional de Alertas e Notificações</i>"]:::external
    end

    Municipe -.->|É atendido presencialmente por| Operador
    Operador -->|Autentica e opera prontuários via HTTPS| RPM
    Gestor -->|Administra infraestrutura, usuários e formulários| RPM
    Fiscal -->|Monitora indicadores analíticos desidentificados| RPM

    RPM -->|Valida domínio institucional corporativo| GoogleAuth
    RPM -->|Persiste prontuários, atendimentos e logs com trava| GoogleSheets
    RPM -->|Armazena cópias de segurança diárias| GoogleDrive
    RPM -->|Dispara avisos de credenciais e integridade de backup| GoogleMail
```

### Atores e Interações

- **Profissional da Rede Intersetorial (Operador):** Usuários dos órgãos vinculados (CREAS, CRAS, Saúde, PM, GCM, Polícia Civil, Casa da Mulher) que registram atendimentos, histórico de violência e composição familiar.
- **Administrador Técnico (Superusuário):** Gestor do sistema (`RPM_EMAIL_SUPER_USUARIO`) com privilégio para cadastrar operadores, setores, módulos de proteção e campos personalizados.
- **Controle Social (Conselhos e Órgãos Fiscalizadores):** Acesso desidentificado para acompanhamento de métricas agregadas sem exposição de dados pessoais.
- **Munícipe / Vítima:** Titular dos dados pessoais sensíveis protegidos pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

---

## 2. Contêineres (Containers)

```mermaid
flowchart TB
    classDef clientApp fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef serverless fill:#0277bd,stroke:#01579b,stroke-width:2px,color:#fff;
    classDef database fill:#1b5e20,stroke:#0a3b13,stroke-width:2px,color:#fff;
    classDef storage fill:#e65100,stroke:#bf360c,stroke-width:2px,color:#fff;
    classDef scheduler fill:#d84315,stroke:#bf360c,stroke-width:2px,color:#fff;
    classDef email fill:#6a1b9a,stroke:#4a148c,stroke-width:2px,color:#fff;

    subgraph Cliente["Ambiente do Cliente (Browser Desktop / Mobile)"]
        SPA["<b>Single Page Application (SPA)</b><br/>[HTML5, CSS3, JavaScript ES6+]<br/>Interface responsiva servida pelo HtmlService"]:::clientApp
    end

    subgraph Execucao["Plataforma Serverless Google Apps Script (Engine V8)"]
        BackendApp["<b>Backend Serverless Controller</b><br/>[backend.gs]<br/>Controlador de sessão, orquestrador de negócio, autorização e sanitização"]:::serverless
        CronTrigger["<b>Scheduled Task Engine</b><br/>[ScriptApp Trigger]<br/>Rotina diária de backup automatizado"]:::scheduler
    end

    subgraph Persistencia["Armazenamento e Serviços Google Workspace"]
        DatabaseSheet[("<b>Banco de Dados Tabular</b><br/>[Google Spreadsheet Institucional]<br/>Tabelas relacionais: Vítimas, Atendimentos, Usuários, Auditoria")]:::database
        DriveBackup[("<b>Storage de Backup em Nuvem</b><br/>[Google Drive Compartilhado]<br/>Snapshots diários isolados com retenção institucional")]:::storage
        MailService["<b>Serviço de Correio</b><br/>[MailApp Service]<br/>Entrega transacional de confirmações de backup e alertas"]:::email
    end

    SPA -->|Chamadas RPC assíncronas via google.script.run| BackendApp
    CronTrigger -->|Disparo programado diário time-based| BackendApp

    BackendApp -->|Leitura e escrita transacional com ScriptLock| DatabaseSheet
    BackendApp -->|Gera cópia da planilha inteira via DriveApp| DriveBackup
    BackendApp -->|Dispara mensagens eletrônicas seguras| MailService
```

### Matriz de Tecnologias e Protocolos

| Contêiner | Tecnologia | Papel e Responsabilidade | Protocolo de Integração |
|---|---|---|---|
| **Frontend Web (SPA)** | HTML5, CSS3, JavaScript V8 | Interface de usuário, navegação por abas, validação prévia de formulários e controle de sessão no cliente. | HTTPS / RPC nativo `google.script.run` |
| **Backend Serverless** | Google Apps Script (Engine V8 / `backend.gs`) | Regras de negócio, autenticação com PBKDF2/SHA-256, autorização RBAC, controle de concorrência (`LockService`) e auditoria. | Execução gerenciada no Google Cloud |
| **Agendador (Cron)** | Google Apps Script `ScriptApp` Triggers | Gatilho temporal diário (`configurarBackupAutomaticoRPM`) para backup autônomo. | Evento temporal do Google Scheduler |
| **Banco de Dados** | Google Sheets (`RPM_DB_ID`) | Camada de persistência relacional modelada em abas com bloqueio concorrencial por script. | SpreadsheetApp API |
| **Storage de Backups** | Google Drive (`RPM_PASTA_BACKUP_ID`) | Armazenamento de cópias de segurança integrais em Drive Compartilhado restrito. | DriveApp API |
| **Serviço de E-mail** | Gmail / MailApp | Disparo de alertas operacionais (`RPM_EMAIL_VALIDACAO_BACKUP`) e avisos de acesso. | MailApp API |

---

## 3. Componentes (Components)

### Componentes do Backend (`backend.gs`)

```mermaid
flowchart TB
    classDef gate fill:#0288d1,stroke:#01579b,stroke-width:2px,color:#fff;
    classDef comp fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef ext fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff;

    subgraph ClientBridge["Borda de Entrada do Backend"]
        DoGet["<b>Router & EntryPoint</b><br/>[doGet / include]<br/>Renderiza templates e monta parciais HTML"]:::gate
        RPCGateway["<b>Gateway RPC</b><br/>Invocação direta via google.script.run"]:::gate
    end

    subgraph ModulosBackend["Serviços Internos"]
        AuthSecurity["<b>Auth & Security Manager</b><br/>• validarLoginManual<br/>• criarSessaoUsuario / validarSessao<br/>• Hashing PBKDF2 / SHA-256<br/>• Rate Limiting de Tentativas"]:::comp
        ProntuarioService["<b>Prontuário & Atendimento Core</b><br/>• buscarVitimaPorCpf / upsertVitima<br/>• salvarAtendimento / salvarComposicaoFamiliar<br/>• Sanitização e Validação de CPF"]:::comp
        FormConfigEngine["<b>Dynamic Form Schema Engine</b><br/>• listarCamposGlobais<br/>• buscarCamposFormulario<br/>• salvarCamposDoSetor<br/>• adicionarNovoCampoFormulario"]:::comp
        AnalyticsEngine["<b>Analytics & Geocoding Engine</b><br/>• obterDadosDashboard<br/>• montarPerfisFiltrosDashboard_<br/>• geocodificarEnderecoDashboard_"]:::comp
        SocialControlService["<b>Controle Social Service</b><br/>• obterAcompanhamentosControleSocial<br/>• Anonimização e Conformidade LGPD"]:::comp
        AdminOrgService["<b>User & Organization Admin</b><br/>• listarUsuariosDaBase / salvarNovoUsuario<br/>• listarSetoresBase / editarSetor<br/>• inicializarEstruturaModularRPM"]:::comp
        AuditEngine["<b>Audit & LGPD Compliance Tracker</b><br/>• registrarAuditoria<br/>• resumirIdentificador (Mascaramento)"]:::comp
        BackupWorker["<b>Backup & Disaster Recovery Worker</b><br/>• criarBackupManualRPM<br/>• criarBackupAutomaticoRPM<br/>• enviarConfirmacaoBackupRPM"]:::comp
    end

    subgraph PersistenciaExterna["Persistência e Recursos Google"]
        ConnSheets[("<b>Conexão e Trava</b><br/>[conectarBanco & LockService]")]:::ext
        DriveAPI[("<b>DriveApp API</b>")]:::ext
        MailAPI["<b>MailApp API</b>"]:::ext
    end

    RPCGateway --> AuthSecurity
    RPCGateway --> ProntuarioService
    RPCGateway --> FormConfigEngine
    RPCGateway --> AnalyticsEngine
    RPCGateway --> SocialControlService
    RPCGateway --> AdminOrgService
    RPCGateway --> BackupWorker

    AuthSecurity --> AuditEngine
    ProntuarioService --> AuditEngine
    AdminOrgService --> AuditEngine
    BackupWorker --> AuditEngine

    ProntuarioService --> ConnSheets
    FormConfigEngine --> ConnSheets
    AnalyticsEngine --> ConnSheets
    SocialControlService --> ConnSheets
    AdminOrgService --> ConnSheets
    AuditEngine --> ConnSheets

    BackupWorker --> DriveAPI
    BackupWorker --> MailAPI
    AuthSecurity --> MailAPI
```

### Componentes da Interface Web (Frontend)

```mermaid
flowchart TB
    classDef shell fill:#1565c0,stroke:#0d47a1,stroke-width:2px,color:#fff;
    classDef module fill:#00838f,stroke:#006064,stroke-width:2px,color:#fff;
    classDef styleToken fill:#558b2f,stroke:#33691e,stroke-width:2px,color:#fff;

    subgraph UIComponents["Camada de Apresentação e Interação"]
        Shell["<b>Core Shell & Navigation</b><br/>[index.html / scripts.html]<br/>Controle de abas, layout principal, autenticação e modais"]:::shell
        ProntuarioUI["<b>Módulo de Prontuários</b><br/>[scripts.html]<br/>Busca por CPF, formulário multipasso e histórico intersetorial"]:::module
        DashboardUI["<b>Módulo de Inteligência Gerencial</b><br/>[dashboard.html / dashboard-scripts.html / dashboard-filtros-scripts.html]<br/>Gráficos analíticos, métricas agregadas e filtros dinâmicos"]:::module
        AdminUI["<b>Módulo de Administração</b><br/>[admin-usuarios.html / admin-usuarios-scripts.html]<br/>Gestão de operadores, setores, módulos e campos customizados"]:::module
        ControleSocialUI["<b>Módulo de Controle Social</b><br/>[controle-social.html / controle-social-scripts.html]<br/>Listagens e relatórios de conformidade anonimizados"]:::module
        RelatorioUI["<b>Módulo de Relatórios</b><br/>[relatorio-scripts.html]<br/>Impressão de fichas de atendimento e exportações"]:::module
        DesignSystem["<b>Design System & Estilos</b><br/>[estilos.html]<br/>Variáveis CSS, componentes de interface e responsividade"]:::styleToken
    end

    Shell --> ProntuarioUI
    Shell --> DashboardUI
    Shell --> AdminUI
    Shell --> ControleSocialUI
    Shell --> RelatorioUI
    DesignSystem -.->|Estiliza de forma global| Shell
```

---

## 4. Código e Modelagem de Dados (Code & Data Model)

### Modelo de Entidade-Relacionamento das Abas (Spreadsheet ERD)

A planilha Google Sheets opera como um banco de dados relacional com integridade referencial mantida via código:

```mermaid
erDiagram
    USUARIOS {
        string ID PK "Identificador único do usuário"
        string Nome "Nome completo do operador"
        string Email UK "E-mail institucional"
        string Perfil "Super / Admin / Operador / Observador / Controle Social"
        string Setor "Órgão / Setor vinculado"
        string Status "Ativo / Inativo"
        string HashSenha "Hash SHA-256 com salt e 5000 iterações"
        string Salt "Sal criptográfico randômico"
        string ExigeTrocaSenha "SIM / NAO"
    }

    SETORES {
        string ID PK "Sigla ou ID do setor (ex: CREAS, GCM)"
        string Nome "Nome por extenso do órgão"
        string Status "Ativo / Inativo"
        string DataCriacao "Data de cadastro"
    }

    MODULOS_PROTECAO {
        string ID_Modulo PK "Identificador (RPM, RPCA, RPI, RPD)"
        string Nome_Modulo "Nome completo da linha de proteção"
        string Status "Ativo / Inativo"
    }

    ORGAOS_MODULOS {
        string Orgao FK "Sigla do órgão/setor"
        string ID_Modulo FK "Módulo vinculado"
        string Status "Ativo / Inativo"
    }

    VITIMAS {
        string CPF PK "CPF normalizado (apenas números)"
        string Nome "Nome completo da vítima"
        string NomeSocial "Nome social / Tratamento"
        string DataNascimento "Data de nascimento (YYYY-MM-DD)"
        string Telefone "Contato principal"
        string Endereco "Logradouro, número e complemento"
        string Bairro "Bairro para mapeamento territorial"
        string Cidade "Município"
        string CEP "Código postal"
        string DataCadastro "Data do primeiro registro no sistema"
    }

    COMPOSICAO_FAMILIAR {
        string ID PK "Identificador do registro de parentesco"
        string CPF_Vitima FK "Vínculo com a vítima principal"
        string Nome "Nome do familiar / dependente / agressor"
        string Parentesco "Grau de parentesco ou vínculo"
        string Idade "Idade informada"
        string Observacoes "Detalhes adicionais"
    }

    ATENDIMENTOS {
        string ID PK "Código único do atendimento"
        string CPF_Vitima FK "Vínculo com o prontuário da vítima"
        string Setor FK "Órgão responsável pelo atendimento"
        string DataHora "Data e horário do registro"
        string Relato "Descrição dos fatos e intervenção"
        string Encaminhamentos "Ações articuladas com outros setores"
        string OperadorEmail "E-mail do profissional responsável"
        string InformacoesEspecificas "JSON com campos dinâmicos do setor"
    }

    CAMPOS_FORMULARIO {
        string ID PK "ID do campo customizado"
        string Setor FK "Setor proprietário do campo ou GLOBAL"
        string Label "Rótulo legível no formulário"
        string Tipo "texto / selecao / data / numero"
        string Opcoes "Valores pré-definidos para tipo selecao"
        string Obrigatorio "SIM / NAO"
        string Status "Ativo / Inativo"
    }

    AUDITORIA {
        string Timestamp PK "Data/Hora ISO do evento"
        string Operador "Identificador resumido do operador"
        string Acao "Ação executada (LOGIN, UPSERT, CONSULTA, BACKUP)"
        string Detalhes "Metadados da operação sem expor segredos"
        string IP_Origem "Identificador do contexto da sessão"
    }

    USUARIOS }o--|| SETORES : "Pertence a"
    ORGAOS_MODULOS }o--|| SETORES : "Habilita órgão em"
    ORGAOS_MODULOS }o--|| MODULOS_PROTECAO : "Integra módulo"
    VITIMAS ||--o{ ATENDIMENTOS : "Possui histórico de"
    VITIMAS ||--o{ COMPOSICAO_FAMILIAR : "Possui familiares vinculados a"
    SETORES ||--o{ ATENDIMENTOS : "Presta"
    SETORES ||--o{ CAMPOS_FORMULARIO : "Configura campos em"
```

---

### Fluxos Críticos de Execução

#### 1. Autenticação, Hashing e Rate Limiting

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador (Navegador)
    participant ClientJS as scripts.html (Client)
    participant Backend as backend.gs (validarLoginManual)
    participant Cache as CacheService (ScriptCache)
    participant Sheet as Planilha (USUARIOS)
    participant Audit as Planilha (AUDITORIA)

    Operador->>ClientJS: Informa E-mail e Senha
    ClientJS->>Backend: google.script.run.validarLoginManual(email, senha)
    
    Backend->>Cache: tentativasLoginEsgotadas(chave)
    alt Limite de Tentativas Excedido (Bloqueio Ativo)
        Cache-->>Backend: Bloqueio ativo (Rate Limit estourado)
        Backend-->>ClientJS: Erro: "Muitas tentativas. Aguarde X minutos."
        ClientJS-->>Operador: Exibe alerta de bloqueio temporário
    else Limite Permitido
        Backend->>Sheet: Localiza registro na aba USUARIOS
        alt Usuário não encontrado ou Inativo
            Backend->>Cache: registrarFalhaLogin(chave)
            Backend->>Audit: registrarAuditoria("FALHA_LOGIN", email)
            Backend-->>ClientJS: Erro: "Credenciais inválidas"
        else Usuário Localizado
            Backend->>Backend: gerarHashSenha(senha, salt, 5000 iterações)
            alt Hash confere com base de dados
                Backend->>Cache: limparFalhasLogin(chave)
                Backend->>Backend: criarSessaoUsuario(usuario)
                Backend->>Audit: registrarAuditoria("LOGIN_SUCESSO", email)
                Backend-->>ClientJS: Retorna { tokenSessao, usuario, exigeTrocaSenha }
                ClientJS->>Operador: Redireciona para Dashboard / Prontuários
            else Hash divergente
                Backend->>Cache: registrarFalhaLogin(chave)
                Backend->>Audit: registrarAuditoria("FALHA_SENHA", email)
                Backend-->>ClientJS: Erro: "Credenciais inválidas"
            end
        end
    end
```

#### 2. Registro Transacional de Atendimento com Bloqueio de Concorrência

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador Setorial
    participant ClientJS as scripts.html (Client)
    participant Backend as backend.gs (salvarAtendimento)
    participant Lock as LockService (ScriptLock)
    participant Sheet as Planilha (ATENDIMENTOS / VITIMAS)
    participant Audit as Planilha (AUDITORIA)

    Operador->>ClientJS: Preenche formulário de atendimento e submete
    ClientJS->>ClientJS: Valida campos obrigatórios e formato de CPF
    ClientJS->>Backend: google.script.run.salvarAtendimento(token, payloadAtendimento)

    Backend->>Backend: validarSessao(token)
    alt Sessão Inválida ou Expirada
        Backend-->>ClientJS: Erro: "Sessão expirada. Faça login novamente."
    else Sessão Válida
        Backend->>Lock: waitLock(30000ms)
        alt Lock Adquirido com Sucesso
            Backend->>Sheet: upsertVitima(dadosVitima)
            Backend->>Sheet: appendRow(dadosAtendimento)
            Backend->>Sheet: salvarComposicaoFamiliar(membros)
            Backend->>Audit: registrarAuditoria("REGISTRO_ATENDIMENTO", CPF_Resumido)
            Backend->>Lock: releaseLock()
            Backend-->>ClientJS: Sucesso: { prontuarioAtualizado }
            ClientJS-->>Operador: Exibe confirmação e atualiza timeline
        else Timeout no Lock (> 30s)
            Backend-->>ClientJS: Erro: "Servidor ocupado. Tente novamente em instantes."
        end
    end
```

#### 3. Pipeline de Backup Automatizado

```mermaid
sequenceDiagram
    autonumber
    participant Trigger as ScriptApp Trigger (Diário)
    participant Worker as backend.gs (criarBackupAutomaticoRPM)
    participant Config as ScriptProperties
    participant SheetsAPI as SpreadsheetApp
    participant DriveAPI as DriveApp
    participant MailAPI as MailApp

    Trigger->>Worker: Executa rotina diária às 03:00 (Time-driven)
    Worker->>Config: obterConfiguracaoProducao()
    Config-->>Worker: Retorna { dbId, pastaBackupId, emailValidacaoBackup, prefixoBackup }

    Worker->>SheetsAPI: openById(dbId)
    Worker->>DriveAPI: getFileById(dbId)
    Worker->>DriveAPI: getFolderById(pastaBackupId)
    
    Worker->>DriveAPI: makeCopy(nomeArquivoTimestamp, pastaDestino)
    Note over Worker,DriveAPI: Snapshot completo da base gerado no Drive Compartilhado
    
    Worker->>Worker: Validar integridade e tamanho do arquivo copiado
    Worker->>MailAPI: sendEmail(emailValidacaoBackup, "Sucesso: Backup Diário RPM", sumarioExecucao)
    Worker->>SheetsAPI: registrarAuditoria("BACKUP_AUTOMATICO_CONCLUIDO")
```

---

## Matriz de Rastreabilidade

Mapeamento entre arquivos físicos, componentes lógicos e níveis da arquitetura:

| Artefato Físico | Nível C4 | Componente Lógico Associado | Funções Críticas de Entrada |
|---|---|---|---|
| `backend.gs` | Nível 3 & 4 | `Auth & Security Manager` | `validarLoginManual`, `criarSessaoUsuario`, `validarSessao`, `gerarHashSenha`, `tentativasLoginEsgotadas` |
| `backend.gs` | Nível 3 & 4 | `Prontuário & Atendimento Core` | `buscarVitimaPorCpf`, `upsertVitima`, `salvarAtendimento`, `salvarComposicaoFamiliar`, `salvarEdicaoCadastroVitima` |
| `backend.gs` | Nível 3 & 4 | `Dynamic Form Schema Engine` | `listarCamposGlobais`, `buscarCamposFormulario`, `adicionarNovoCampoFormulario`, `salvarCamposDoSetor` |
| `backend.gs` | Nível 3 & 4 | `Analytics & Geocoding Engine` | `obterDadosDashboard`, `montarPerfisFiltrosDashboard_`, `geocodificarEnderecoDashboard_` |
| `backend.gs` | Nível 3 & 4 | `Audit & Compliance Tracker` | `registrarAuditoria`, `resumirIdentificador`, `normalizarCpfsBaseRPM` |
| `backend.gs` | Nível 3 & 4 | `Backup & Disaster Recovery` | `criarBackupManualRPM`, `criarBackupAutomaticoRPM`, `configurarBackupAutomaticoRPM` |
| `index.html` / `scripts.html` | Nível 3 | `Core Shell & Routing Manager` | Gerenciamento de abas, ciclo de vida do DOM, modal de troca de senha, formulários de prontuário |
| `dashboard*.html` | Nível 3 | `Dashboard Analytics Component` | Renderização de gráficos, filtros multidimensionais e indicadores setoriais |
| `admin-usuarios*.html` | Nível 3 | `Administration & Config` | Painel de controle de operadores, permissões, ativação de módulos e campos setoriais |
| `controle-social*.html` | Nível 3 | `Social Control & Transparency` | Visualização de dados agregados/anonimizados para conselheiros municipais |
| `relatorio-scripts.html` | Nível 3 | `Reporting & Export Engine` | Impressão e exportação de relatórios estruturados |
| `estilos.html` | Nível 3 | `Design System & Token Store` | Definição de tokens de cores, layout responsivo, tipografia e componentes acessíveis |
| `validate-code.js` | Nível 4 | `CI/CD Static Code Validator` | Validação de sintaxe, testes de integridade estrutural e prevenção de regressões |

```mermaid
flowchart LR
    classDef fileNode fill:#eceff1,stroke:#607d8b,stroke-width:1px,color:#263238;
    classDef compNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:1px,color:#1a237e;
    classDef c4Node fill:#e0f2f1,stroke:#00897b,stroke-width:2px,color:#004d40;

    subgraph Arquivos["Arquivos Físicos"]
        F_Backend["backend.gs"]:::fileNode
        F_Index["index.html + scripts.html"]:::fileNode
        F_Dash["dashboard*.html"]:::fileNode
        F_Admin["admin-usuarios*.html"]:::fileNode
        F_Social["controle-social*.html"]:::fileNode
        F_Relat["relatorio-scripts.html"]:::fileNode
        F_Estilos["estilos.html"]:::fileNode
        F_Val["validate-code.js"]:::fileNode
    end

    subgraph Componentes["Componentes Lógicos"]
        C_Auth["Auth & Security Manager"]:::compNode
        C_Pront["Prontuário & Atendimento Core"]:::compNode
        C_Form["Dynamic Form Schema Engine"]:::compNode
        C_Analytics["Analytics & Geocoding Engine"]:::compNode
        C_Audit["Audit & Compliance Tracker"]:::compNode
        C_Backup["Backup & Disaster Recovery"]:::compNode
        C_Shell["Core Shell & Routing"]:::compNode
        C_DashUI["Dashboard Analytics"]:::compNode
        C_AdminUI["Admin & Config"]:::compNode
        C_SocialUI["Social Control"]:::compNode
        C_RelatUI["Reporting Engine"]:::compNode
        C_DS["Design System"]:::compNode
        C_CI["CI/CD Static Validator"]:::compNode
    end

    subgraph C4Niveis["Níveis C4"]
        N3["<b>Nível 3</b><br/>(Components)"]:::c4Node
        N4["<b>Nível 4</b><br/>(Code / Schema)"]:::c4Node
    end

    F_Backend --> C_Auth & C_Pront & C_Form & C_Analytics & C_Audit & C_Backup
    F_Index --> C_Shell
    F_Dash --> C_DashUI
    F_Admin --> C_AdminUI
    F_Social --> C_SocialUI
    F_Relat --> C_RelatUI
    F_Estilos --> C_DS
    F_Val --> C_CI

    C_Shell & C_DashUI & C_AdminUI & C_SocialUI & C_RelatUI & C_DS --> N3
    C_Auth & C_Pront & C_Form & C_Analytics & C_Audit & C_Backup --> N3
    C_Auth & C_Pront & C_Audit & C_Backup & C_CI --> N4
```
