# O Que Quero Fazer

Uma lista pessoal para guardar atividades que ainda quero viver, aprender e realizar. Nesta primeira fase, todos os dados ficam no navegador, em `localStorage`.

## Começar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Para validar o bundle de produção, use `npm run build`; para conferir o código, use `npm run lint`.

## O que está disponível

- Criar, editar, excluir e atualizar o status de atividades.
- Categorias: Livros, Filmes e séries, Cursos, Projetos, Lugares e Outros.
- Busca por título, filtros por categoria e status e cards expansíveis.
- Imagem e link externo opcionais.
- Exportação e importação de um arquivo JSON versionado. A importação valida os registros e pede confirmação antes de substituir a lista atual.

## Persistência e backup

A chave `o-que-quero-fazer:activities:v1` guarda registros com ID, categoria, status e datas ISO. A camada de acesso fica em `lib/activities.ts`; a interface usa funções para ler, criar, atualizar, remover e validar os dados. Uma implementação SQLite futura pode substituir essas funções sem alterar os componentes visuais.

O armazenamento é local ao perfil do navegador e dispositivo. Limpar os dados do navegador pode remover a lista; exporte backups JSON para guardá-la ou transferi-la. Não há conta, sincronização, servidor ou recuperação automática.

## Estrutura principal

- `app/`: rota principal, metadados e estilos responsivos.
- `components/activities-app.tsx`: página interativa, formulários, filtros e backup.
- `components/ui/`: botão reutilizável e cards expansíveis.
- `lib/activities.ts`: modelo, validação e acesso ao `localStorage`.
- `lib/utils.ts`: utilitário `cn` para classes compatíveis com shadcn/ui.

As categorias e os estados definidos no MVP estão em `lib/activities.ts`. A interface não inclui backend, login ou APIs.
