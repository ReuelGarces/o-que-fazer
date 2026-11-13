# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário principal é o próprio responsável pelo projeto. Ele usa a lista para guardar atividades pessoais que quer viver, aprender e realizar. Nenhum outro público foi confirmado.

## Product Purpose

Guardar ideias para viver, aprender e realizar, e ajudar a escolher o próximo passo. A implementação atual organiza essas ideias como atividades, permitindo cadastrá-las, encontrá-las e acompanhar seu andamento. A interface usa “ideia” na entrada e na lista, e “atividade” nos formulários e nas ações de manutenção. Não foi definido um indicador de sucesso além desse uso.

## Positioning

Ainda não definido. O usuário não confirmou “lista pessoal, simples e local no navegador, com backup manual” como diferencial. Armazenamento local e ausência de conta e sincronização descrevem a implementação atual, não uma promessa de posicionamento.

## Operating Context

Uso individual no navegador. Os registros ficam no `localStorage` do perfil e dispositivo em uso; um arquivo JSON permite exportar e importar a lista. Limpar os dados do navegador pode remover os registros, então a cópia precisa ser guardada pelo usuário.

## Current Workflows

Os fluxos abaixo foram verificados no código em 13 de novembro de 2026; descrevem o produto implementado, sem estabelecer novas promessas de posicionamento.

- A página única apresenta “Guardar uma ideia” na entrada e conduz à seção “Sua lista”. A primeira utilização oferece “Adicionar primeira ideia”; com registros existentes, a lista oferece “Adicionar ideia”.
- Cadastro e edição acontecem em um diálogo. O título é obrigatório; categoria e status começam em “Outros” e “Quero fazer”. Descrição, URL da imagem e link externo ficam em “Adicionar detalhes”, uma seção opcional que abre quando o registro editado já tem detalhes.
- A busca considera o título e combina com os filtros de categoria e status. Os contadores por status também funcionam como filtros; clicar novamente no contador ativo remove esse filtro. Os contadores mostram os totais da coleção, enquanto a lista informa a quantidade de resultados.
- Cards revelam detalhes por cursor, foco de teclado ou toque. Suas ações permitem mudar o status, abrir o link externo, editar e solicitar exclusão. A exclusão exige confirmação; não há ação de desfazer.
- Lista vazia, busca sem resultados e falha de leitura local têm mensagens e ações próprias. Uma busca sem resultados permite limpar todos os filtros.
- Exportar gera um arquivo JSON da coleção completa. Importar valida o arquivo e solicita confirmação; substitui a coleção local inteira, sem mesclar registros.

## Capabilities and Constraints

- Categorias atuais: Livros; Filmes e séries; Cursos; Projetos; Lugares; Outros.
- Status atuais: Quero fazer; Em andamento; Concluído.
- Cada atividade exige título e tem categoria e status; descrição, imagem e link externo são opcionais. Título e descrição têm limites de 120 e 2.000 caracteres. Imagem e link são referências por URL HTTP ou HTTPS, sem upload de arquivo.
- A lista oferece busca por título, filtros por categoria e status, e cards expansíveis.
- Exportação e importação usam backup JSON versionado. A importação valida os registros e pede confirmação antes de substituir a lista atual.
- Persistência atual: `localStorage`, na chave `o-que-quero-fazer:activities:v1`. Não há conta, sincronização, servidor, API ou recuperação automática.
- Backup versão 1 conserva identificadores e datas de criação e atualização. Registros inválidos, categorias ou status desconhecidos e identificadores duplicados são rejeitados. A leitura inicial não regrava os dados; um backup válido pode substituir dados locais indisponíveis.
- O escopo atual não oferece prazos, lembretes, prioridades, categorias personalizadas ou compartilhamento de listas. Essas ausências descrevem o código atual, não restrições para evolução futura.
- Projeto existente: Next.js 16 e React 19. A interface atual está em português do Brasil.

## Brand Commitments

O nome apresentado na página e nos metadados é “O que fazer?”. O README e a identificação de compatibilidade do backup ainda usam “O Que Quero Fazer”; preservar a compatibilidade dos dados ao evoluir a nomenclatura. A comunicação atual convida a guardar ideias e escolher o próximo passo. O rodapé atribui os direitos a Reuel Garcês e aponta para seus perfis no GitHub e LinkedIn.

## Evidence on Hand

- `components/activities-app.tsx`: entrada, lista, filtros, formulário, feedback, exclusão e backup.
- `components/ui/expanding-cards.tsx` e `components/ui/search-with-category.tsx`: interação dos cards e busca com categoria.
- `lib/activities.ts`: modelo, validações, persistência e contrato do backup.
- `app/layout.tsx` e `components/ui/footer.tsx`: nome público, idioma e atribuição.
- `README.md`: instruções de execução e descrição funcional. A possibilidade de SQLite citada ali não é uma capacidade implementada nem um compromisso confirmado.

Não há depoimentos, estudos de caso, pesquisas externas ou métricas de resultado confirmados; não inventar essas evidências. O público pessoal anteriormente confirmado é mantido; a reestruturação do código não comprova expansão de público.

## Product Principles

- Guardar ideias de atividades que o usuário quer viver, aprender e realizar.
- Permitir que o usuário organize e acompanhe essas atividades por categoria e status.
- Permitir exportar e restaurar a lista por meio de um backup JSON.

## Accessibility & Inclusion

A implementação inclui rótulos para controles, feedback anunciado por tecnologias assistivas, foco visível, expansão dos cards por teclado e respeito à preferência por movimento reduzido. A confirmação de exclusão devolve o foco ao acionador ou ao título da lista. Esses mecanismos são evidência do código, sem constituir certificação de conformidade ou validação com usuários. Nenhum padrão obrigatório ou necessidade específica adicional foi confirmado.
