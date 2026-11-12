# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário principal é o próprio responsável pelo projeto. Ele usa a lista para guardar atividades pessoais que quer viver, aprender e realizar. Nenhum outro público foi confirmado.

## Product Purpose

Reunir essas atividades em uma lista que possa ser organizada e acompanhada. A versão atual permite cadastrar, editar e excluir itens, localizar atividades por título, categoria e status, e acompanhar se estão em “Quero fazer”, “Em andamento” ou “Concluído”. Não foi definido um indicador de sucesso além desse uso.

## Positioning

Ainda não definido. O usuário não confirmou “lista pessoal, simples e local no navegador, com backup manual” como diferencial. Armazenamento local e ausência de conta e sincronização descrevem a implementação atual, não uma promessa de posicionamento.

## Operating Context

Uso individual no navegador. Os registros ficam no `localStorage` do perfil e dispositivo em uso; um arquivo JSON permite exportar e importar a lista. Limpar os dados do navegador pode remover os registros, então a cópia precisa ser guardada pelo usuário.

## Capabilities and Constraints

- Categorias atuais: Livros; Filmes e séries; Cursos; Projetos; Lugares; Outros.
- Status atuais: Quero fazer; Em andamento; Concluído.
- Cada atividade pode ter título, descrição, imagem e link externo. Título e descrição têm limites de 120 e 2.000 caracteres.
- A lista oferece busca por título, filtros por categoria e status, e cards expansíveis.
- Exportação e importação usam backup JSON versionado. A importação valida os registros e pede confirmação antes de substituir a lista atual.
- Persistência atual: `localStorage`, na chave `o-que-quero-fazer:activities:v1`. Não há conta, sincronização, servidor, API ou recuperação automática.
- Projeto existente: Next.js 16 e React 19. A interface atual está em português do Brasil.

## Evidence on Hand

O README e a implementação existente documentam e demonstram os recursos listados acima. Não há depoimentos, estudos de caso, pesquisas externas ou métricas de resultado confirmados; não inventar essas evidências.

## Product Principles

- Guardar ideias de atividades que o usuário quer viver, aprender e realizar.
- Permitir que o usuário organize e acompanhe essas atividades por categoria e status.
- Permitir exportar e restaurar a lista por meio de um backup JSON.
