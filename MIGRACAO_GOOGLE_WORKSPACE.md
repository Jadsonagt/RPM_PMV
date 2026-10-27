# Migração para o Google Workspace da Prefeitura

Este sistema trata dados pessoais sensíveis. A implantação de produção deve ser feita exclusivamente por uma conta institucional da Prefeitura, nunca por uma conta pessoal.

## O que já foi preparado no código

- O Web App foi configurado para acesso apenas ao domínio do implantador (`DOMAIN`).
- IDs da planilha, pasta de backup e e-mails institucionais foram retirados do código.
- A configuração agora fica nas Propriedades do script.
- A página não permite mais ser incorporada livremente em outros sites.

## Decisões necessárias antes da implantação

1. Definir a conta técnica institucional que será proprietária e fará a implantação, por exemplo `sistemas-rede-protecao@<dominio-da-prefeitura>`.
2. Confirmar o domínio Workspace que poderá acessar o sistema.
3. Definir a pasta institucional de backups, preferencialmente em Drive Compartilhado com acesso restrito à equipe responsável.
4. Validar, com Encarregado/LGPD e TI, quem pode consultar os dados e por quanto tempo os backups serão retidos.

## Preparação pelo administrador do Workspace

1. Crie a conta técnica e habilite Apps Script, Drive, Sheets e Gmail para ela.
2. Crie um Drive Compartilhado restrito para o sistema e outro, com acesso ainda mais limitado, para backups.
3. Copie a planilha de produção para o Drive Compartilhado. Não reutilize a planilha de testes sem antes higienizar dados de teste e revisar os compartilhamentos.
4. Compartilhe a planilha e a pasta de backups com a conta técnica como Gerenciador. Não compartilhe arquivos por link público.
5. Revogue o acesso das contas pessoais ao projeto, à planilha e às pastas depois da validação e da entrada em produção.

## Criar e configurar o projeto Apps Script institucional

1. Faça login no Workspace com a conta técnica.
2. Crie um novo projeto Apps Script no Drive Compartilhado ou transfira uma cópia do projeto para esse ambiente. A implantação precisa ser recriada no domínio institucional.
3. Envie este código para o novo projeto. Não reutilize o `scriptId` do arquivo `.clasp.json` atual.
4. Em **Configurações do projeto > Propriedades do script**, crie estas propriedades:

| Propriedade | Valor |
| --- | --- |
| `RPM_DB_ID` | ID da planilha institucional de produção |
| `RPM_EMAIL_SUPER_USUARIO` | e-mail institucional do administrador principal |
| `RPM_PASTA_BACKUP_ID` | ID da pasta institucional de backups |
| `RPM_EMAIL_VALIDACAO_BACKUP` | caixa institucional que receberá os avisos de backup |
| `RPM_PREFIXO_BACKUP` | opcional; padrão `RPM_Backup_` |

5. Execute, pelo editor, `autorizarEnvioEmail()` e `autorizarDrive()` para conceder as permissões à conta técnica.
6. Execute `configurarBackupAutomaticoRPM()` uma única vez. Confirme em **Acionadores** que o gatilho diário foi criado pela conta técnica.

## Publicação e validação

1. Em **Implantar > Nova implantação > App da Web**, selecione:
   - Executar como: **usuário que fez a implantação**;
   - Quem tem acesso: **somente usuários do domínio da Prefeitura**.
2. Use primeiro **Testar implantações** com uma conta administradora e uma conta comum do domínio.
3. Faça o checklist abaixo antes de liberar a URL `/exec`:
   - usuário fora do domínio não acessa;
   - usuário sem cadastro no sistema não consegue entrar;
   - cada perfil vê apenas os recursos e dados permitidos;
   - criação, redefinição de senha e auditoria funcionam;
   - backup manual cria arquivo na pasta correta e envia o aviso;
   - backup automático aparece em Acionadores e é testado;
   - planilha e backups não estão compartilhados externamente;
   - nenhuma conta pessoal permanece como proprietária ou editora.

## Operação contínua

- Distribua a URL de produção somente após o aceite da TI e do responsável pela LGPD.
- Use uma conta institucional para cada pessoa; não compartilhe contas nem senhas.
- Revise mensalmente os compartilhamentos do Drive, usuários administradores e histórico de auditoria.
- Documente o procedimento de revogação imediata de acesso e de restauração de backup.
