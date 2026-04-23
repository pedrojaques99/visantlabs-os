/**
 * Module: Charts & Data Visualization
 *
 * Rules for creating charts, graphs, and dashboards in Figma.
 * Triggered by keywords: chart, graph, gráfico, dashboard, dados, data
 */

export const CHART_RULES = `GRAFICOS - REGRAS OBRIGATORIAS:

ESTRUTURA (hierarquia exata):
1. Frame ROOT "Chart" - width:750, height:280, layoutMode:HORIZONTAL, itemSpacing:0
2. Frame "Y-Axis" - layoutSizingVertical:"FILL", layoutMode:VERTICAL, counterAxisAlignItems:MAX, primaryAxisAlignItems:SPACE_BETWEEN
3. Frame "Bars" - layoutSizingHorizontal:"FILL", layoutSizingVertical:"FILL", layoutMode:HORIZONTAL, itemSpacing:4, counterAxisAlignItems:MAX
4. Cada "Bar-Col" - width:36, layoutSizingVertical:"HUG", layoutMode:VERTICAL, counterAxisAlignItems:CENTER, itemSpacing:4

PROPRIEDADES OBRIGATORIAS EM FRAMES FILHOS:
- Frame filho SEM auto-layout: DEVE ter width E height
- Frame filho COM auto-layout: DEVE ter layoutSizingHorizontal + layoutSizingVertical OU width/height fixos
- Barras (Rectangle): SEMPRE width E height explícitos

ALINHAMENTO PELA BASE:
- Frame "Bars" DEVE ter counterAxisAlignItems:"MAX" para barras alinharem pelo bottom

CALCULO ALTURA (range 35.5M-36.5M, maxHeight=200):
barHeight = ((valor - 35500000) / 1000000) * 200

CORES:
- Barras: #F97316 (laranja)
- Labels: #666666
- Fundo: branco`;

export const CHART_EXAMPLE = `EXEMPLO GRAFICO BARRAS (copie a estrutura):
[
  {"type":"CREATE_FRAME","ref":"chart","props":{"name":"Chart","width":750,"height":280,"layoutMode":"HORIZONTAL","itemSpacing":0,"fills":[{"type":"SOLID","color":{"r":1,"g":1,"b":1}}],"paddingTop":16,"paddingBottom":40,"paddingLeft":16,"paddingRight":16}},
  {"type":"CREATE_FRAME","ref":"yaxis","parentRef":"chart","props":{"name":"Y-Axis","width":80,"layoutMode":"VERTICAL","layoutSizingVertical":"FILL","counterAxisAlignItems":"MAX","primaryAxisAlignItems":"SPACE_BETWEEN","paddingRight":8}},
  {"type":"CREATE_TEXT","parentRef":"yaxis","props":{"name":"Label","content":"100","fontSize":11,"fills":[{"type":"SOLID","color":{"r":0.4,"g":0.4,"b":0.4}}],"textAlignHorizontal":"RIGHT"}},
  {"type":"CREATE_TEXT","parentRef":"yaxis","props":{"name":"Label","content":"0","fontSize":11,"fills":[{"type":"SOLID","color":{"r":0.4,"g":0.4,"b":0.4}}],"textAlignHorizontal":"RIGHT"}},
  {"type":"CREATE_FRAME","ref":"bars","parentRef":"chart","props":{"name":"Bars","layoutMode":"HORIZONTAL","layoutSizingHorizontal":"FILL","layoutSizingVertical":"FILL","itemSpacing":6,"counterAxisAlignItems":"MAX"}},
  {"type":"CREATE_FRAME","ref":"col0","parentRef":"bars","props":{"name":"Bar-Col/Jan","width":36,"layoutMode":"VERTICAL","layoutSizingVertical":"HUG","counterAxisAlignItems":"CENTER","itemSpacing":4}},
  {"type":"CREATE_RECTANGLE","parentRef":"col0","props":{"name":"Bar","width":36,"height":160,"fills":[{"type":"SOLID","color":{"r":0.976,"g":0.451,"b":0.086}}],"cornerRadius":2}},
  {"type":"CREATE_TEXT","parentRef":"col0","props":{"name":"Label","content":"Jan","fontSize":10,"fills":[{"type":"SOLID","color":{"r":0.4,"g":0.4,"b":0.4}}]}}
]`;

export const DASHBOARD_RULES = `DASHBOARD (multiplos graficos):
- Frame principal: layoutMode VERTICAL ou grid (layoutWrap: WRAP)
- Cada gráfico em seu próprio frame com padding consistente
- Títulos: fontSize 14-16, fontStyle Bold, acima de cada gráfico
- Espaçamento entre gráficos: 24-32px
- Cores: manter paleta consistente entre gráficos`;
