# Sistema Integrado da Rede de Proteção — Votorantim

Aplicação institucional para registro, acompanhamento e gestão de atendimentos da Rede de Proteção. O sistema centraliza informações de vítimas, atendimentos, setores envolvidos, relatórios e painéis gerenciais.

> **Dados sensíveis:** este repositório contém código de um sistema que trata dados pessoais. Nunca envie planilhas de produção, backups, credenciais, IDs de arquivos do Google Drive ou dados de usuários ao GitHub.

---

## Funcionalidades

- autenticação de usuários e perfis de acesso;
- cadastro e consulta de prontuários;
- registro de atendimentos por setor;
- gestão de usuários, setores e campos de formulário;
- painel gerencial e relatórios;
- acompanhamento para controle social;
- trilha de auditoria;
- backups manuais e automáticos da base de dados.

```mermaid
flowchart LR
    classDef domain fill:#0d47a1,stroke:#1565c0,stroke-width:2px,color:#fff;
    classDef feature fill:#e3f2fd,stroke:#90caf9,stroke-width:1px,color:#0d47a1;

    subgraph ModAtendimento["Atendimento e Prontuários"]
        F1["Cadastro e Consulta de Prontuários"]:::feature
        F2["Registro de Atendimentos por Setor"]:::feature
        F3["Composição Familiar e Vínculos"]:::feature
    end

    subgraph ModSeguranca["Segurança e Acesso"]
        F4["Autenticação e Perfis (RBAC)"]:::feature
        F5["Trilha de Auditoria Imutável"]:::feature
        F6["Backups Manuais e Automáticos"]:::feature
    end

    subgraph ModGestao["Gestão e Parametrização"]
        F7["Gestão de Usuários e Setores"]:::feature
        F8["Campos de Formulário Dinâmicos"]:::feature
        F9["Linhas Modulares de Proteção"]:::feature
    end

    subgraph ModInteligencia["Inteligência e Controle"]
        F10["Painel Gerencial e BI"]:::feature
        F11["Acompanhamento p/ Controle Social"]:::feature
        F12["Emissão de Fichas e Relatórios"]:::feature
    end

    RPMSystem["<b>Rede de Proteção</b><br/>Funcionalidades Centrais"]:::domain
    RPMSystem --> ModAtendimento
    RPMSystem --> ModSeguranca
    RPMSystem --> ModGestao
    RPMSystem --> ModInteligencia
```

---

## Arquitetura

O projeto é uma aplicação Web do **Google Apps Script**.

| Componente | Tecnologia |
| --- | --- |
| Interface | HTML, CSS e JavaScript, servido pelo Apps Script |
| Backend | Google Apps Script (`backend.gs`) |
| Base de dados | Google Sheets institucional |
| Arquivos e backups | Google Drive institucional |
| E-mails | Gmail/Google Workspace via Apps Script |
| Publicação | Web App do Google Apps Script |

---

## Estrutura do repositório

| Arquivo | Finalidade |
| --- | --- |
| `backend.gs` | regras de negócio, persistência, auditoria, permissões e backups |
| `index.html` | interface principal e autenticação |
| `scripts.html` | scripts da interface principal |
| `admin-usuarios*.html` | administração de usuários e configurações |
| `dashboard*.html` | painel gerencial e filtros |
| `controle-social*.html` | módulo de controle social |
| `relatorio-scripts.html` | geração de relatórios |
| `estilos.html` | estilos compartilhados |
| `appsscript.json` | manifesto e permissões do Apps Script |
| `validate-code.js` | validações estáticas do projeto |

```mermaid
flowchart TD
    classDef entry fill:#1e88e5,stroke:#0d47a1,stroke-width:2px,color:#fff;
    classDef partial fill:#e1f5fe,stroke:#4fc3f7,stroke-width:1px,color:#01579b;
    classDef logic fill:#43a047,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef tool fill:#f57c00,stroke:#e65100,stroke-width:1px,color:#fff;

    Index["<b>index.html</b><br/>Template Base e Layout"]:::entry
    Estilos["<b>estilos.html</b><br/>Design System e CSS"]:::partial
    ScriptsMain["<b>scripts.html</b><br/>Controlador do Prontuário"]:::partial
    Admin["<b>admin-usuarios*.html</b><br/>Módulo Administrativo"]:::partial
    Dash["<b>dashboard*.html</b><br/>Painel BI e Filtros"]:::partial
    Social["<b>controle-social*.html</b><br/>Módulo Social"]:::partial
    Relat["<b>relatorio-scripts.html</b><br/>Gerador de Relatórios"]:::partial

    Backend["<b>backend.gs</b><br/>Regras de Negócio e Persistência"]:::logic
    Manifesto["<b>appsscript.json</b><br/>Manifesto e Permissões"]:::tool
    Validator["<b>validate-code.js</b><br/>Testes Estáticos CI"]:::tool

    Index --> Estilos
    Index --> ScriptsMain
    Index --> Admin
    Index --> Dash
    Index --> Social
    Index --> Relat

    ScriptsMain -.->|google.script.run| Backend
    Admin -.->|google.script.run| Backend
    Dash -.->|google.script.run| Backend
    Social -.->|google.script.run| Backend
    Relat -.->|google.script.run| Backend

    Validator -.->|Valida integridade| Backend
    Validator -.->|Valida sintaxe| Index
    Validator -.->|Valida isolamento| ScriptsMain
```

---

## Requisitos

- Node.js 18 ou superior;
- conta Google Workspace institucional com acesso ao Apps Script, Sheets, Drive e Gmail;
- permissões de edição no projeto Apps Script de destino;
- `@google/clasp` para sincronizar o código com o Apps Script.

---

## Instalação e validação local

```bash
npm install
node validate-code.js
```

O comando de validação verifica a sintaxe dos arquivos e invariantes essenciais. Ele não acessa nem altera dados do Google Workspace.

---

## Configuração no Google Workspace

A produção deve ser operada por uma conta técnica institucional. Os valores de ambiente ficam em **Configurações do projeto > Propriedades do script** e não devem ser colocados no código:

| Propriedade | Descrição |
| --- | --- |
| `RPM_DB_ID` | ID da planilha institucional de produção |
| `RPM_EMAIL_SUPER_USUARIO` | e-mail institucional do administrador principal |
| `RPM_PASTA_BACKUP_ID` | ID da pasta institucional de backups |
| `RPM_EMAIL_VALIDACAO_BACKUP` | caixa institucional para avisos de backup |
| `RPM_PREFIXO_BACKUP` | prefixo opcional dos arquivos de backup |

O Web App deve ser publicado com estas opções:

- **Executar como:** usuário que fez a implantação;
- **Quem tem acesso:** somente usuários do domínio da Prefeitura.

O roteiro completo está em [MIGRACAO_GOOGLE_WORKSPACE.md](MIGRACAO_GOOGLE_WORKSPACE.md).

---

## Desenvolvimento e publicação

1. Trabalhe em uma branch própria.
2. Execute `node validate-code.js` antes de criar um commit.
3. Faça revisão de código antes de enviar alterações à branch principal.
4. Publique primeiro em homologação e valide com contas institucionais de teste.
5. Crie uma nova versão e implantação do Web App para produção após aprovação da TI e do responsável pela LGPD.

> O arquivo `.clasp.json` identifica um projeto Apps Script específico. Não reutilize o identificador de desenvolvimento para produção e não versione arquivos com credenciais.

```mermaid
flowchart LR
    classDef step fill:#f5f5f5,stroke:#bdbdbd,stroke-width:1px,color:#212121;
    classDef gate fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#e65100;
    classDef success fill:#e8f5e9,stroke:#4caf50,stroke-width:2px,color:#1b5e20;

    B1["1. Branch de Trabalho<br/><code>feature/minha-alteracao</code>"]:::step
    B2["2. Validação Local<br/><code>node validate-code.js</code>"]:::gate
    B3["3. Pull Request e<br/>Revisão de Código"]:::step
    B4["4. Deploy Homologação<br/>(clasp push / testes)"]:::step
    B5["5. Aprovação TI e LGPD"]:::gate
    B6["6. Deploy em Produção<br/>(Nova Implantação)"]:::success

    B1 --> B2
    B2 -->|Passou| B3
    B3 --> B4
    B4 --> B5
    B5 -->|Aprovado| B6
```

---

## Segurança e LGPD

- Use contas individuais e institucionais; nunca compartilhe senhas.
- Mantenha planilha, backups e projeto Apps Script em ambientes institucionais com acesso mínimo necessário.
- Não publique a base de dados, backups ou exports em repositórios, e-mails ou links públicos.
- Revise periodicamente usuários, permissões do Drive, perfis administrativos e registros de auditoria.
- Revogue acessos imediatamente quando uma pessoa deixar a equipe ou mudar de função.

---

## Suporte e governança

Para mudanças em produção, registre a solicitação com a equipe de TI responsável e obtenha validação das áreas gestora e de proteção de dados quando a alteração impactar dados, perfis de acesso ou fluxo de atendimento.

---

## Licença

Uso institucional. A distribuição, reutilização ou divulgação depende de autorização da Prefeitura de Votorantim.

---

# Documentação Arquitetural — Modelo C4

Esta seção formaliza a arquitetura de engenharia do **Sistema Integrado da Rede de Proteção (RPM - Votorantim)** empregando o **Modelo C4** (*Context, Containers, Components, Code*), decompondo a solução desde sua relação com atores externos até os detalhes de fluxo algorítmico e esquemas relacionais no Google Workspace.

```mermaid
flowchart TB
    classDef level1 fill:#08427b,stroke:#052a4f,stroke-width:2px,color:#fff;
    classDef level2 fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff;
    classDef level3 fill:#238e5a,stroke:#18613e,stroke-width:2px,color:#fff;
    classDef level4 fill:#438dd5,stroke:#266099,stroke-width:2px,color:#fff;

    L1["<b>NÍVEL 1: CONTEXTO</b><br/>Fronteira do Sistema, Atores Humanos e Serviços Google Workspace"]:::level1
    L2["<b>NÍVEL 2: CONTÊINERES</b><br/>Aplicações SPA, Backend Serverless, Planilha, Drive e Scheduler"]:::level2
    L3["<b>NÍVEL 3: COMPONENTES</b><br/>Módulos de Negócio, Autenticação, Prontuário, Formulários e BI"]:::level3
    L4["<b>NÍVEL 4: CÓDIGO</b><br/>Esquema Relacional ERD, Fluxos Criptográficos e Bloqueio de Concorrência"]:::level4

    L1 -->|zoom-in detalhado| L2
    L2 -->|zoom-in modular| L3
    L3 -->|zoom-in algorítmico| L4
```

---

## C4 — Nível 1: Diagrama de Contexto (System Context)

O nível de Contexto descreve o posicionamento do sistema em relação aos atores humanos e às fronteiras de sistemas integrados da infraestrutura governamental e do ecossistema Google Workspace.

### Diagrama de Contexto do Sistema

```mermaid
flowchart TB
    classDef person fill:#08427b,stroke:#052a4f,stroke-width:2px,color:#fff;
    classDef system fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff;
    classDef external fill:#757575,stroke:#424242,stroke-width:2px,color:#fff;

    subgraph Atores["Atores e Usuários Institucionais"]
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

### Detalhamento dos Atores e Interações de Contexto

1. **Profissional da Rede Intersetorial (Operador):**
   - Atuantes nos órgãos cadastrados: CREAS, CRAS, Saúde, Polícia Militar (PM), Guarda Civil Municipal (GCM), Polícia Civil, Casa da Mulher, etc.
   - Operam autenticados sob controle de perfil (RBAC), criando e atualizando cadastros de vítimas, histórico familiar e relatórios de acolhimento.
2. **Administrador Técnico e Funcional (Superusuário):**
   - Usuário institucional com poderes absolutos definidos via `RPM_EMAIL_SUPER_USUARIO`.
   - Executa a manutenção de setores, ativação de módulos de proteção (`RPM`, `RPCA`, `RPI`, `RPD`), campos dinâmicos, credenciais e auditoria.
3. **Controle Social e Órgãos Fiscalizadores:**
   - Visualizam métricas consolidadas e listas anonimizadas/desidentificadas em conformidade com a LGPD, garantindo transparência pública sem exposição de dados pessoais.
4. **Munícipe / Vítima:**
   - Titular dos dados sensíveis protegidos pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

---

## C4 — Nível 2: Diagrama de Contêineres (Containers)

O nível de Contêineres detalha as unidades de execução de software, os armazenamentos de dados e os protocolos de comunicação utilizados na solução.

### Diagrama de Contêineres

```mermaid
flowchart TB
    classDef clientApp fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef serverless fill:#0277bd,stroke:#01579b,stroke-width:2px,color:#fff;
    classDef database fill:#1b5e20,stroke:#0a3b13,stroke-width:2px,color:#fff;
    classDef storage fill:#e65100,stroke:#bf360c,stroke-width:2px,color:#fff;
    classDef scheduler fill:#d84315,stroke:#bf360c,stroke-width:2px,color:#fff;
    classDef email fill:#6a1b9a,stroke:#4a148c,stroke-width:2px,color:#fff;

    subgraph Cliente["Ambiente do Cliente (Browser Desktop / Mobile)"]
        SPA["<b>Single Page Application (SPA)</b><br/>[HTML5, Vanilla CSS3, JavaScript ES6+]<br/>Interface responsiva servida pelo HtmlService do Apps Script"]:::clientApp
    end

    subgraph Execucao["Plataforma Serverless Google Apps Script (Engine V8)"]
        BackendApp["<b>Backend Serverless Controller</b><br/>[Google Apps Script - backend.gs]<br/>Controlador de sessão, orquestrador de negócio, autorização e sanitização"]:::serverless
        CronTrigger["<b>Scheduled Task Engine</b><br/>[ScriptApp Trigger]<br/>Executa rotina diária de backup automatizado"]:::scheduler
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

### Matriz de Contêineres e Tecnologias

| Contêiner | Tecnologia | Papel e Responsabilidade | Protocolo de Integração |
|---|---|---|---|
| **Frontend Web (SPA)** | HTML5, CSS3, JavaScript V8 | Interface com o usuário, renderização dinâmica de telas, validação prévia de formulários, controle de máscaras e gestão do token de sessão no cliente. | HTTPS / RPC nativo `google.script.run` |
| **Backend Serverless** | Google Apps Script (Engine V8 / `backend.gs`) | Ponto único de entrada, gerenciamento de autenticação, hashing de senhas, validações de negócio, concorrência (`LockService`) e auditoria. | Execução interna gerenciada pelo Google Cloud |
| **Agendador (Cron)** | Google Apps Script `ScriptApp` Triggers | Gatilho temporal diário (`configurarBackupAutomaticoRPM`) que executa o processo de salvaguarda de dados sem intervenção humana. | Invocação interna por evento do Google Scheduler |
| **Banco de Dados** | Google Sheets (`RPM_DB_ID`) | Camada de persistência relacional modelada em abas com bloqueio concorrencial por script. | SpreadsheetApp API (Google Workspace) |
| **Storage de Backups** | Google Drive (`RPM_PASTA_BACKUP_ID`) | Repositório isolado em Drive Compartilhado para snapshots imutáveis com retenção controlada. | DriveApp API (Google Workspace) |
| **Serviço de E-mail** | Gmail / MailApp | Disparo de alertas operacionais para `RPM_EMAIL_VALIDACAO_BACKUP` e notificações de primeiro acesso. | MailApp API (Google Workspace) |

---

## C4 — Nível 3: Diagrama de Componentes (Components)

O nível de Componentes decompõe os contêineres de Frontend e Backend em seus módulos lógicos de responsabilidade única.

### Componentes do Backend (`backend.gs`)

```mermaid
flowchart TB
    classDef gate fill:#0288d1,stroke:#01579b,stroke-width:2px,color:#fff;
    classDef comp fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef ext fill:#455a64,stroke:#263238,stroke-width:2px,color:#fff;

    subgraph ClientBridge["Borda de Entrada do Backend"]
        DoGet["<b>Router & EntryPoint</b><br/>[doGet / include]<br/>Avalia templates e injeta parciais HTML"]:::gate
        RPCGateway["<b>Gateway RPC de Requisições</b><br/>Ponto de invocação direta via google.script.run"]:::gate
    end

    subgraph ModulosBackend["Módulos de Serviços Internos (backend.gs)"]
        AuthSecurity["<b>Auth & Security Manager</b><br/>• validarLoginManual<br/>• criarSessaoUsuario / validarSessao<br/>• PBKDF2 / SHA-256 Hash<br/>• Rate Limiting de Tentativas"]:::comp
        ProntuarioService["<b>Prontuário & Atendimento Core</b><br/>• buscarVitimaPorCpf<br/>• upsertVitima<br/>• salvarAtendimento<br/>• salvarComposicaoFamiliar<br/>• Sanitização / Máscara CPF"]:::comp
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

### Componentes da Camada Frontend (Interface Web)

```mermaid
flowchart TB
    classDef shell fill:#1565c0,stroke:#0d47a1,stroke-width:2px,color:#fff;
    classDef module fill:#00838f,stroke:#006064,stroke-width:2px,color:#fff;
    classDef styleToken fill:#558b2f,stroke:#33691e,stroke-width:2px,color:#fff;

    subgraph UIComponents["Camada de Apresentação e Interação"]
        Shell["<b>Core Shell & Navigation</b><br/>[index.html / scripts.html]<br/>Controle de abas, layout principal, validação de login e modais"]:::shell
        ProntuarioUI["<b>Módulo de Prontuários</b><br/>[scripts.html]<br/>Busca por CPF, formulário multipasso, histórico intersetorial"]:::module
        DashboardUI["<b>Módulo de Inteligência Gerencial</b><br/>[dashboard.html / dashboard-scripts.html / dashboard-filtros-scripts.html]<br/>Gráficos analíticos, métricas agregadas e filtros dinâmicos"]:::module
        AdminUI["<b>Módulo de Administração</b><br/>[admin-usuarios.html / admin-usuarios-scripts.html]<br/>Gestão de operadores, setores, módulos e campos customizados"]:::module
        ControleSocialUI["<b>Módulo de Controle Social</b><br/>[controle-social.html / controle-social-scripts.html]<br/>Listagens e relatórios de conformidade anonimizados"]:::module
        RelatorioUI["<b>Módulo de Emissão de Relatórios</b><br/>[relatorio-scripts.html]<br/>Impressão de fichas de atendimento e exportações"]:::module
        DesignSystem["<b>Design System & Estilos</b><br/>[estilos.html]<br/>Variáveis CSS, componentes utilitários, acessibilidade e modais"]:::styleToken
    end

    Shell --> ProntuarioUI
    Shell --> DashboardUI
    Shell --> AdminUI
    Shell --> ControleSocialUI
    Shell --> RelatorioUI
    DesignSystem -.->|Estiliza de forma global| Shell
```

---

## C4 — Nível 4: Código e Implementação (Code / ERD / Sequence)

O nível de Código aprofunda a implementação em quatro dimensões fundamentais:
1. **Modelagem Relacional das Abas do Google Sheets (ERD)**;
2. **Ciclo de Vida e Segurança da Autenticação (PBKDF2/SHA-256 + Rate Limit)**;
3. **Fluxo Transacional de Registro de Atendimento com Concorrência (`LockService`)**;
4. **Pipeline Automatizado de Backup e Resiliência Operacional**.

### 1. Modelo de Entidade-Relacionamento das Abas (Spreadsheet ERD)

A base de dados opera em uma planilha Google Sheets estruturada como um banco de dados relacional tabular:

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

### 2. Fluxo de Autenticação, Hashing e Mitigação de Força Bruta

O sistema implementa uma camada de autenticação com derivação de chave iterativa (5.000 iterações de SHA-256) e bloqueio exponencial por IP/usuário via `CacheService`:

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

---

### 3. Fluxo de Atendimento com Concorrência e Bloqueio de Script (`LockService`)

Como o Google Sheets não possui mecanismos de bloqueio de linha nativo via API, o backend protege escritas concorrentes por meio do `LockService.getScriptLock()`:

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

---

### 4. Pipeline de Backup Automatizado e Salvaguarda Institucional

O processo de disaster recovery opera em background, disparado diariamente pelo acionador temporal institucional do Apps Script:

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

## Matriz de Rastreabilidade: Código vs. Componentes C4

Para assegurar integridade no ciclo de vida de manutenção e desenvolvimento do sistema, a tabela abaixo mapeia cada arquivo físico e bloco funcional do repositório aos seus respectivos níveis do modelo C4:

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

### Visualização Gráfica da Rastreabilidade (Artefatos ➔ Camadas ➔ C4)

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

    subgraph C4Niveis["Níveis do Modelo C4"]
        N3["<b>C4 Nível 3</b><br/>(Components)"]:::c4Node
        N4["<b>C4 Nível 4</b><br/>(Code / Schema)"]:::c4Node
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
