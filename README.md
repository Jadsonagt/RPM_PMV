<div align="center">

[![📖 Página 1: Visão Geral](https://img.shields.io/badge/📖_Página_1-Visão_Geral_&_Operação-0969da?style=for-the-badge)](README.md)
[![🏛️ Página 2: Modelo C4](https://img.shields.io/badge/🏛️_Página_2-Arquitetura_(Modelo_C4)-6e7781?style=for-the-badge)](ARQUITETURA.md)

---
</div>

# Sistema Integrado da Rede de Proteção — Votorantim

Aplicação institucional para registro, acompanhamento e gestão de atendimentos da Rede de Proteção. O sistema centraliza informações de vítimas, atendimentos, setores envolvidos, relatórios e painéis gerenciais.

> **Dados sensíveis:** este repositório contém código de um sistema que trata dados pessoais. Nunca envie planilhas de produção, backups, credenciais, IDs de arquivos do Google Drive ou dados de usuários ao GitHub.

## Funcionalidades

- autenticação de usuários e perfis de acesso;
- cadastro e consulta de prontuários;
- registro de atendimentos por setor;
- gestão de usuários, setores e campos de formulário;
- painel gerencial e relatórios;
- acompanhamento para controle social;
- trilha de auditoria;
- backups manuais e automáticos da base de dados.

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

## Requisitos

- Node.js 18 ou superior;
- conta Google Workspace institucional com acesso ao Apps Script, Sheets, Drive e Gmail;
- permissões de edição no projeto Apps Script de destino;
- `@google/clasp` para sincronizar o código com o Apps Script.

## Instalação e validação local

```bash
npm install
node validate-code.js
```

O comando de validação verifica a sintaxe dos arquivos e invariantes essenciais. Ele não acessa nem altera dados do Google Workspace.

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
- **Quem tem acesso:** qualquer pessoa, inclusive sem uma Conta do Google conectada. O acesso efetivo ao sistema continua limitado aos e-mails cadastrados na aba `USUARIOS`, com senha e perfil de acesso.

O roteiro completo está em [MIGRACAO_GOOGLE_WORKSPACE.md](MIGRACAO_GOOGLE_WORKSPACE.md).

### Primeira implantação: começando com uma planilha nova

Siga esta ordem. Ela evita criar um projeto no local errado ou liberar uma base antes das permissões estarem corretas.

1. **Dê um nome à planilha.** Sugestão: `RPM — Base de Dados — Produção`. Evite colocar nomes de pessoas, vítimas ou números de documentos no título do arquivo.
2. **Mova a planilha para um Drive Compartilhado institucional** (por exemplo, `Rede de Proteção — Produção`). Não a mantenha no Meu Drive de uma conta pessoal.
3. **Restrinja os compartilhamentos:** inicialmente, apenas a conta técnica do sistema e os administradores formalmente designados devem ter acesso. Desative qualquer opção de acesso por link.
4. **Copie o ID da planilha**, que fica na URL entre `/d/` e `/edit`. Esse é o valor de `RPM_DB_ID`; guarde-o somente nas Propriedades do script, nunca no código ou no GitHub.
5. **Não crie abas e colunas manualmente sem um modelo aprovado.** A aplicação depende de uma estrutura precisa, incluindo `USUARIOS`, `ATENDIMENTOS`, `VÍTIMAS`, `SETORES`, `FORMULARIOS_CONFIG` e `AUDITORIA`.
6. **Não coloque dados reais ainda.** Primeiro publique e valide com contas e registros de teste. A migração de dados antigos deve ser planejada, revisada e feita apenas após autorização da gestão e da LGPD.

> Abrir **Extensões > Apps Script** cria um projeto vinculado à planilha. Isso não é um erro, mas, para este projeto, recomenda-se usar um projeto Apps Script institucional separado, associado à conta técnica e versionado por `clasp`. Assim, código, permissões e base de dados ficam administrados de forma independente.

### Enviar o código ao Apps Script sem copiar e colar

Na pasta deste repositório, com a conta institucional autenticada, execute:

```bash
npx clasp login
npx clasp create --type webapp --title "Sistema Integrado da Rede de Proteção"
npx clasp push
```

O segundo comando cria um projeto Apps Script novo e atualiza o identificador local do projeto. Não use o identificador do projeto antigo de desenvolvimento. Depois do envio:

1. abra o novo projeto Apps Script criado;
2. adicione as Propriedades do script da tabela acima, começando por `RPM_DB_ID`;
3. conclua a estrutura inicial da base usando o modelo de dados aprovado pela equipe do sistema;
4. execute e autorize `autorizarDrive()` e `autorizarEnvioEmail()`;
5. crie uma implantação de teste antes da produção.

### Opção recomendada para a base de dados

Se já existir uma base anterior funcional, a opção mais segura é **copiar a planilha inteira para o Drive Compartilhado institucional**, preservando abas, cabeçalhos e fórmulas, e depois revisar as permissões. Uma planilha totalmente vazia exige a criação controlada da estrutura de dados e do primeiro usuário administrador antes de o login funcionar.

## Desenvolvimento e publicação

1. Trabalhe em uma branch própria.
2. Execute `node validate-code.js` antes de criar um commit.
3. Faça revisão de código antes de enviar alterações à branch principal.
4. Publique primeiro em homologação e valide com contas institucionais de teste.
5. Crie uma nova versão e implantação do Web App para produção após aprovação da TI e do responsável pela LGPD.

> O arquivo `.clasp.json` identifica um projeto Apps Script específico. Não reutilize o identificador de desenvolvimento para produção e não versione arquivos com credenciais.

## Segurança e LGPD

- Use contas individuais e institucionais; nunca compartilhe senhas.
- Mantenha planilha, backups e projeto Apps Script em ambientes institucionais com acesso mínimo necessário.
- Não publique a base de dados, backups ou exports em repositórios, e-mails ou links públicos.
- Revise periodicamente usuários, permissões do Drive, perfis administrativos e registros de auditoria.
- Revogue acessos imediatamente quando uma pessoa deixar a equipe ou mudar de função.

## Suporte e governança

Para mudanças em produção, registre a solicitação com a equipe de TI responsável e obtenha validação das áreas gestora e de proteção de dados quando a alteração impactar dados, perfis de acesso ou fluxo de atendimento.

## Licença

Uso institucional. A distribuição, reutilização ou divulgação depende de autorização da Prefeitura de Votorantim.
