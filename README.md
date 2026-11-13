
# O que fazer?

Uma aplicação web para organizar ideias de coisas que você quer viver, aprender ou realizar.

Cadastre livros, filmes, cursos, projetos, lugares e outras atividades, acompanhe seu progresso e transforme ideias em experiências.

## Funcionalidades

- Cadastro, edição e exclusão de atividades
- Categorias: Livros, Filmes e séries, Cursos, Projetos, Lugares e Outros
- Status: Quero fazer, Em andamento e Concluído
- Pesquisa por título e filtros combinados
- Cards interativos com detalhes
- Resumo de atividades por status
- Exportação e importação de backups JSON
- Interface responsiva em português

## Tecnologias

- Next.js
- React
- TypeScript
- Tailwind CSS

## Executando localmente

**Requisitos:** Node.js 20.9 ou superior e npm.

Clone o repositório:

```bash
git clone https://github.com/ReuelGarces/o-que-fazer.git
cd o-que-fazer
```

Instale as dependências:

```bash
npm ci
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

Acesse http://localhost:3000.

## Verificações

```bash
npm run lint
npm run build
```

## Armazenamento

A versão atual utiliza `localStorage` para salvar os dados no navegador.

Os dados não são sincronizados entre dispositivos. Utilize a exportação JSON para manter cópias de segurança.

## Roadmap

- [ ] Persistência com SQLite
- [ ] Login com uma única conta
- [ ] Seleção de dois perfis independentes
- [ ] Instalação com Coolify e armazenamento persistente
- [ ] Migração dos dados locais para o banco

## Contribuindo

Contribuições são bem-vindas!

Você pode abrir uma Issue para relatar erros, sugerir melhorias ou enviar um Pull Request.

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).
