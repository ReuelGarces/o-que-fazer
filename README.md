# O que fazer?

Uma lista pessoal de ideias para viver, aprender e realizar. Uma única conta compartilhada dá acesso a **dois perfis independentes**, com atividades, busca, categorias, status e backups próprios. Interface em português, com o design Lavender Glass, cards expansíveis e suporte a telas pequenas.

## Tecnologias e arquitetura

Next.js 16, React 19, TypeScript, Drizzle ORM e SQLite com `better-sqlite3`. O runtime é Node.js 24. O banco é um **arquivo local**, sem servidor de banco nem conexão de rede. As páginas privadas validam a sessão no servidor; Route Handlers repetem a autenticação e a autorização em todas as operações.

As tabelas principais são `accounts`, `profiles` e `activities`; `sessions` permite revogar sessões no logout e `login_attempts` mantém o limite de entrada após reinícios. Senhas usam Argon2id; `iron-session` sela o cookie HttpOnly, SameSite=Lax e Secure em produção, com validade de sete dias. Mudar o segredo invalida todos os cookies existentes.

O perfil selecionado fica na sessão. O servidor confirma sua propriedade e exige que o perfil informado pela página coincida com a sessão. A revisão de cada lista evita sobrescritas entre abas: uma gravação desatualizada retorna conflito, preservando o formulário. Clique em **Atualizar lista** e tente novamente após conferir os dados.

Os tipos e validadores compartilhados ficam em `lib/activities.ts`; `lib/server/` usa `server-only` para impedir importação acidental em componentes cliente. Escritas usam Drizzle, transações, chaves estrangeiras, índices e restrições. IDs de atividades são únicos **dentro do perfil**, permitindo restaurar o mesmo backup nos dois perfis sem alterar o outro.

## Instalação local

Pré-requisitos: Node.js 24 e npm. O driver nativo usa binários compatíveis com a plataforma; caso precise compilar, instale Python e ferramentas C/C++ de build.

```bash
npm ci
```

Copie `.env.example` para `.env.local`. Configure um caminho **absoluto fora do repositório** e um segredo privado aleatório. Exemplo no PowerShell:

```powershell
Copy-Item .env.example .env.local
# Edite SQLITE_PATH em .env.local para:
# C:/Users/SEU_USUARIO/AppData/Local/oquefazer/database.sqlite
# APP_ORIGIN=http://localhost:3000
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Coloque o segredo gerado em `SESSION_SECRET` no arquivo privado. O comando gera somente o segredo, não uma senha de conta. Em Linux, use, por exemplo, `/home/SEU_USUARIO/.local/share/oquefazer/database.sqlite`. O diretório é criado se necessário; seu usuário precisa ter acesso de leitura e escrita.

```bash
npm run db:migrate
npm run db:setup
npm run dev
```

O setup interativo solicita usuário, senha de no mínimo 12 caracteres (entrada oculta e confirmação) e os nomes dos dois perfis. Ele não recebe senha em argumentos, não registra a senha e **recusa execução se já existir uma conta**. Não há cadastro público, senha padrão ou recuperação por e-mail.

Abra [localhost:3000](http://localhost:3000), entre na conta e escolha um perfil. Para verificar o isolamento, crie uma ideia no primeiro perfil, clique em **Trocar perfil** e confirme que o segundo começa vazio. Volte ao primeiro e confira o registro. Na seleção, **Editar perfil** permite alterar nome e avatar. **Sair** revoga a sessão atual.

Para executar a versão otimizada local, use `npm run build` e `npm start`. O Next.js inicia em produção e exige HTTPS para o cookie; use um proxy HTTPS e configure `APP_ORIGIN` com a origem pública. Para desenvolvimento HTTP, use `npm run dev`.

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `SQLITE_PATH` | Caminho absoluto do banco fora do repositório; produção: `/var/lib/sqlite/database.sqlite`. |
| `SESSION_SECRET` | Segredo privado aleatório, mínimo de 32 caracteres. Obrigatório no runtime; não é necessário no build. |
| `APP_ORIGIN` | Origem exata do aplicativo, sem caminho. Ex.: `https://ideias.example.com`. HTTPS obrigatório em produção; usada para CSRF. |
| `PORT` | Porta HTTP interna do Next.js; padrão 3000. |
| `SQLITE_BACKUP_PATH` | Arquivo absoluto **novo** para `npm run db:backup`. Seu diretório deve existir. |
| `SETUP_PASSWORD_FILE` | Alternativa ao terminal: caminho de arquivo secreto com a senha inicial. |
| `SETUP_USERNAME` | Usuário inicial, somente no setup por arquivo. |
| `SETUP_PROFILE_1`, `SETUP_PROFILE_2` | Nomes iniciais, somente no setup por arquivo. |

Nenhuma variável secreta usa o prefixo `NEXT_PUBLIC_`. Os scripts carregam `.env` e `.env.local`; variáveis já definidas no ambiente têm precedência.

Para setup não interativo, monte um arquivo secreto temporário, com permissão 600 ou 400 em Linux, configure `SETUP_PASSWORD_FILE` e os três campos não secretos e execute `npm run db:setup`. O conteúdo não aparece em argumentos nem logs. Remova a montagem e essas variáveis depois. Não copie o arquivo secreto para a imagem ou o repositório.

## Migrações SQLite

O schema fica em `lib/server/schema.ts` e as migrações versionadas em `drizzle/`. Para evoluir o schema:

```bash
npm run db:generate
npm run db:migrate
```

Revise e versione o SQL e os metadados gerados. Nunca edite uma migração já aplicada em instalações reais. Faça backup antes de atualizar. O migrador Drizzle registra migrações concluídas e não as reaplica, preservando os dados. `npm start` aplica as migrações **antes de iniciar o Next.js, após a montagem do volume**; a conexão também verifica as migrações na primeira abertura em desenvolvimento. O build não cria banco nem exige credenciais.

SQLite usa WAL, chaves estrangeiras e espera de até cinco segundos para locks. A abertura e as migrações verificam efetivamente a possibilidade de criar/escrever no arquivo. Falhas interrompem a inicialização. Não execute migrações concorrentes durante atualizações; mantenha uma instância.

## Dados antigos e backups JSON

Ao abrir a lista, o navegador procura a chave `o-que-quero-fazer:activities:v1`. Se houver dados válidos, um aviso informa a quantidade e o perfil de destino. Use **Escolher outro perfil** antes de importar, se necessário, e confirme a importação.

A migração valida todos os registros no servidor, preserva IDs e datas, ignora registros idênticos já importados e rejeita IDs conflitantes **sem importar parcialmente**. O aviso de conclusão informa quantos registros foram adicionados ou já existiam. Confira a lista e exporte um JSON para verificar o resultado. Os dados antigos do navegador nunca são apagados automaticamente. Se estiverem inválidos, faça uma cópia antes de corrigi-los.

**Exportar** consulta o servidor e baixa o backup `ActivityBackup` versão 1 do perfil selecionado. **Importar** valida um backup dessa versão e solicita confirmação antes de substituir todas as atividades **somente desse perfil**, em uma transação. O outro perfil não é afetado. Limites: 8 MB por requisição e 10.000 atividades por importação. Títulos têm até 120 caracteres, descrições até 2.000 e URLs HTTP(S) até 4.096.

## Deploy no Coolify

1. Configure o aplicativo usando o `Dockerfile` deste repositório, porta interna 3000 e **uma réplica**. O build e o runtime usam Debian Bookworm com Node.js 24 para manter a compatibilidade ABI dos módulos nativos; não copie `node_modules` de Windows para Linux nem troque apenas o runtime por Alpine.
2. Monte um **volume persistente no container do aplicativo Next.js** em `/var/lib/sqlite`. O recurso SQLite existente no Coolify só atende a aplicação se o arquivo/volume estiver efetivamente montado nela. SQLite não oferece host, porta ou URL de rede; iniciar um recurso separado não conecta automaticamente os containers.
3. Garanta que o volume seja gravável pelo usuário `node` (UID/GID 1000:1000). Em uma montagem existente, ajuste a propriedade pelo console administrativo do host/volume antes de iniciar; não use permissões 777. Restrinja o acesso ao diretório.
4. Configure, como variáveis privadas de runtime: `SQLITE_PATH=/var/lib/sqlite/database.sqlite`, `SESSION_SECRET` aleatório e `APP_ORIGIN=https://SEU_DOMINIO`. Configure o domínio e TLS no proxy do Coolify. Não é necessário informar segredos no build.
5. O comando padrão `npm start` migra o volume montado e inicia o servidor. Não substitua por `next start`, pois isso pula a etapa explícita de migração do entrypoint.
6. Na primeira instalação, abra o terminal do container como usuário `node` e execute `npm run db:setup` de forma interativa. Alternativamente use a montagem temporária de segredo descrita acima. O servidor pode estar iniciado, mas nenhum login funciona antes do setup.
7. Teste login, dois perfis, CRUD e reinicialização do container. Confirme que os dados permanecem após recriar o container e atualizar a imagem. O Dockerfile não inclui banco ou credenciais.

Não use múltiplas réplicas nem armazenamento de rede com locking SQLite inadequado. Durante uma atualização, pare a instância anterior antes de iniciar outra que use o mesmo volume. Não configure um volume distinto para cada réplica esperando sincronização.

## Backup consistente e restauração SQLite

Com a aplicação ativa, prefira a API de backup online do driver, que inclui alterações confirmadas no WAL:

```bash
# Defina SQLITE_BACKUP_PATH com um nome novo, em um volume/diretório de backup.
npm run db:backup
```

O arquivo gerado é um snapshot SQLite consistente e recebe permissão 600. Guarde cópias fora do host, com acesso restrito: incluem hashes de senha, sessões e os dois perfis. Não basta copiar somente `database.sqlite` enquanto a aplicação grava; alterações podem estar em `database.sqlite-wal`. Não copie os arquivos principal/WAL/SHM separadamente com a aplicação ativa.

Para restaurar: pare o aplicativo e todos os processos que acessam o banco; preserve o conjunto antigo (principal, `-wal`, `-shm`) em outro diretório; coloque a cópia consistente no `SQLITE_PATH`; retire arquivos WAL/SHM antigos desse destino; restaure propriedade e permissões; inicie a aplicação e valide os dois perfis. Troque `SESSION_SECRET` para invalidar sessões do snapshot restaurado. Faça um ensaio de restauração antes de depender do backup. A exportação JSON é complementar e contém somente as atividades de um perfil.

## Verificações

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:integration
# Testes visuais e funcionais opcionais no Chromium:
npx playwright install chromium
npm run test:ui
```

Os testes unitários usam arquivos temporários isolados e cobrem validações, setup, Argon2id, CRUD, isolamento, concorrência, importação/exportação, migração local, rollback, integridade e idempotência SQLite. A integração inicia o build Next.js em uma porta livre, com credenciais aleatórias e banco temporário; verifica páginas privadas, CSRF, cookies de produção, troca de perfil, CRUD, importações, autorização, logout e expiração. Execute o build antes da integração e dos testes de navegador. O teste de navegador cobre login, erro de autenticação, seleção e edição de perfis, CRUD, filtros, exportação/restauração JSON, migração local, manutenção do formulário em falhas e envio pendente. Também salva capturas de desktop (1440 px) e celular (390 px) fora do repositório; `UI_ARTIFACT_DIR` permite escolher o diretório.

## Arquivos da implementação

| Situação | Arquivos |
| --- | --- |
| Criados: servidor | `lib/server/auth.ts`, `credentials.ts`, `database.ts`, `errors.ts`, `schema.ts`, `store.ts` (todos em `lib/server/`). |
| Criados: API e telas | `app/api/[...path]/route.ts`, `app/login/page.tsx`, `app/profiles/page.tsx`, `components/account-screens.tsx`, `lib/api.ts`. |
| Criados: migrações | `drizzle.config.ts`, `drizzle/0000_initial.sql`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/_journal.json`. |
| Criados: operação | `scripts/migrate.ts`, `scripts/setup.ts`, `scripts/start.ts`, `scripts/backup.ts`, `Dockerfile`, `.dockerignore`, `.env.example`. |
| Criados: testes | `tests/backend.test.ts`, `tests/scripts.test.ts`, `tests/http.integration.ts`, `tests/browser.e2e.ts`. |
| Modificados | `README.md`, `app/page.tsx`, `app/globals.css`, `components/activities-app.tsx`, `lib/activities.ts`, `next.config.ts`, `package.json`, `package-lock.json`. |

Dependências adicionadas de runtime: `drizzle-orm`, `better-sqlite3`, `iron-session`, `@node-rs/argon2`, `server-only` e `tsx` (os scripts de inicialização executam TypeScript). Ferramentas de desenvolvimento: `drizzle-kit`, `@types/better-sqlite3` e `@playwright/test`.

## Limitações

Uma conta, exatamente dois perfis, uma instância Node.js e um arquivo SQLite local. Os perfis compartilham acesso: não são uma barreira de privacidade entre as duas pessoas. A seleção é compartilhada pelas abas do mesmo navegador; o servidor bloqueia operações de páginas com o perfil anterior. Navegadores/dispositivos distintos têm sessões independentes.


## Contribuição e licença

Veja [CONTRIBUTING.md](CONTRIBUTING.md), [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) e [LICENSE](LICENSE). Preserve a interface em português e não versione `.env`, senhas ou arquivos SQLite reais.

## Controles de login em produção

O limite persistente agora é de cinco verificações por combinação de usuário/senha em 15 minutos. A chave usa HMAC-SHA256 com SESSION_SECRET, sem armazenar senhas tentadas. Login correto remove seu contador. Erros com outras senhas não bloqueiam a senha correta. Um teto global de 120 verificações por minuto limita o trabalho Argon2 e protege contra dicionários com senhas diferentes. Ataques contínuos ainda podem provocar indisponibilidade; este mecanismo não resolve DDoS. As reservas são atômicas e os registros expirados são removidos na tentativa seguinte. O contador global legado é ignorado e expira naturalmente. A troca do segredo também muda as chaves dos contadores.

Nenhum cabeçalho de IP encaminhado é usado para limitação ou autorização. Isso evita confiar em X-Forwarded-For controlável pelo cliente e funciona atrás do proxy Coolify. Exponha somente o proxy TLS e restrinja a porta interna. Limites no proxy são uma defesa adicional opcional. Respostas de usuário/senha continuam genéricas, com verificação Argon2id também para usuários desconhecidos. Não há recuperação pública de senha nem serviços externos obrigatórios.

## Agendamento e retenção de backups

O script abre somente um banco existente em leitura, sem migrá-lo. Usa a [API online SQLite](https://www.sqlite.org/backup.html), verifica integridade e cria o destino exclusivamente com modo 600 desde o primeiro byte. Falhas retornam código não zero e removem o destino parcial. O diretório deve ser privado e não gravável por terceiros.

Configure `SQLITE_BACKUP_DIR=/backups` para nomes únicos automáticos e `SQLITE_BACKUP_KEEP=14` para reter os últimos 14 snapshots (inteiro positivo). A retenção ocorre após um snapshot íntegro, somente sobre arquivos regulares com o padrão gerado. `SQLITE_BACKUP_PATH` mantém o modo manual, sem retenção. Nunca use o banco ativo como destino. Restrinja o diretório a 700 e UID/GID 1000; em Windows configure ACLs.

Agende no host com cron/systemd ou em executor externo ao container principal. Exemplo diário às 03:00, adaptando imagem e volumes:

```cron
0 3 * * * flock -n /srv/oquefazer/backup.lock docker run --rm --network none --mount source=VOLUME_SQLITE,target=/var/lib/sqlite --mount type=bind,source=/srv/oquefazer/backups,target=/backups -e SQLITE_PATH=/var/lib/sqlite/database.sqlite -e SQLITE_BACKUP_DIR=/backups -e SQLITE_BACKUP_KEEP=14 IMAGEM_DA_APLICACAO npm run db:backup
```

Prepare o diretório do host para UID/GID 1000 e modo 700. Use a mesma imagem da aplicação e um lock compartilhado por todos os agendamentos; não execute backups concorrentes ou durante migrações. A montagem SQLite precisa permitir acesso aos arquivos WAL/SHM. Não copie esses arquivos separadamente com escritores ativos.

Copie snapshots concluídos para outro servidor ou armazenamento privado, por exemplo com rsync sobre SSH. Credenciais ficam apenas no executor externo. Use criptografia e retenção independente no destino remoto, monitore falhas, espaço livre e idade da última cópia. Falha de upload não afeta a aplicação e não deve apagar a última cópia remota válida.

Ensaio automatizado: `npm test` verifica snapshot com conexão WAL aberta, reabertura isolada, contas/perfis, integridade e retenção. Para ensaio operacional, restaure um snapshot num volume novo sem WAL/SHM antigos, ajuste UID/GID 1000 e modo 600, configure outro domínio e SESSION_SECRET novo e confira login, perfis e atividades. Nunca ensaie sobre dados reais. Para restauração real, pare todos os escritores e siga o procedimento de restauração acima, preservando o conjunto antigo.

## CI e teste de container

Quality Checks executa `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` e `npm run test:integration`, nessa ordem. Cada falha reprova o job. Chromium é opcional.

O job separado Docker Smoke Test constrói a imagem e verifica Node 24, UID/GID 1000, modo 600 do banco, migrações repetidas, inicialização HTTP, reinício, recriação com o mesmo volume e configurações inválidas. Execute `npm run test:docker` com Docker Linux; somente recursos temporários próprios são removidos. Docker não estava disponível no ambiente local desta implementação; a execução no runner permanece pendente.
