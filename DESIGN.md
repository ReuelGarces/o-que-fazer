---
name: "O que fazer?"
description: "Uma lista visual para guardar ideias de atividades e escolher o próximo passo."
colors:
  background: "#f6f3ec"
  foreground: "#292621"
  card: "#fffdf8"
  primary: "#584362"
  primary-foreground: "#ffffff"
  secondary: "#ece6dc"
  muted: "#eee9df"
  muted-foreground: "#6c655b"
  accent: "#e9e3d9"
  border: "#d9d2c7"
  ring: "#584362"
typography:
  display:
    fontFamily: '"Almendra", Georgia, serif'
    fontSize: "clamp(54px, 7vw, 86px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Almendra", Georgia, serif'
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: '"Almendra", Georgia, serif'
    fontSize: "clamp(21px, 2vw, 27px)"
    fontWeight: 400
    lineHeight: 1.08
  body:
    fontFamily: '"Roboto", Arial, sans-serif'
    fontSize: "15px"
    fontWeight: 400
  label:
    fontFamily: '"Roboto", Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 600
rounded:
  control: "8px"
  field: "8px"
  panel: "14px"
  card: "14px"
  dialog: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
  hero:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "0px"
  activity-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
  activity-dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.dialog}"
  footer:
    textColor: "#625c53"
---

# Design System: O que fazer?

## Direção

O produto é uma lista pessoal de ideias para viver, aprender e realizar. A direção visual aproxima a interface de um caderno de planos: papel claro, tinta escura, uma bússola discreta e capas fotográficas apenas quando a atividade tem uma imagem real.

A interface fala de ideias que podem virar atividades. Ela preserva as categorias, status, busca, filtros, edição, exclusão, armazenamento local e backup JSON do produto.

## Cores

O fundo usa papel claro (#f6f3ec), texto carvão (#292621) e superfícies marfim (#fffdf8). O violeta escuro (#584362) fica restrito à ação principal, ao foco e à seleção. Bordas discretas separam áreas; verde e ocre aparecem somente nos estados correspondentes.

O hero usa uma fotografia editorial de caderno, lápis e bússola, com espaço calmo à esquerda para o título. Os cards usam uma superfície neutra por padrão e uma fotografia fornecida pelo usuário quando disponível.

## Tipografia

Almendra dá personalidade aos títulos. Roboto mantém busca, controles, rótulos e formulários fáceis de ler. Ambas as fontes são servidas localmente.

## Layout e interação

A barra superior reúne a marca e as ações de backup. O hero apresenta “Guarde o que quer viver” com uma ação principal. Abaixo ficam o resumo de status, a coleção, os filtros, os cards e um rodapé enxuto com marca, navegação interna e direitos autorais de Reuel Garcês.

No desktop, cada card expande na linha ao receber foco ou hover e mostra descrição, status, link, edição e exclusão. No toque, a expansão ocorre ao selecionar; em telas estreitas os cards se empilham. A interface respeita movimento reduzido, foco de teclado, estados vazios e erros de armazenamento.

