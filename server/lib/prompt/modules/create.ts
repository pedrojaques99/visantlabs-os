/**
 * Module: Create Intent
 *
 * Rules and examples for creation operations.
 */

export const CREATE_RULES = `CRIACAO:
- Primeiro CREATE_FRAME (ref), depois filhos (parentRef)
- Frame ROOT: sempre width + height explicitos
- Frame FILHO: use layoutSizingHorizontal:"FILL" ou "HUG" (sem width/height)
- textAutoResize: "HEIGHT" para texto quebrar linha
- cornerRadius + cornerSmoothing: 0.6 para bordas iOS
- Nomeie semanticamente: "Section/Header", "Card/Body", "Button/Primary"`;

export const CREATE_EXAMPLE = `EXEMPLO (story com secoes):
[
  {"type":"CREATE_FRAME","ref":"story","props":{"name":"Story","width":1080,"height":1920,"layoutMode":"VERTICAL","itemSpacing":0,"fills":[{"type":"SOLID","color":{"r":0.1,"g":0.1,"b":0.1}}]}},
  {"type":"CREATE_FRAME","ref":"header","parentRef":"story","props":{"name":"Section/Header","layoutMode":"HORIZONTAL","layoutSizingHorizontal":"FILL","layoutSizingVertical":"HUG","paddingTop":48,"paddingLeft":32,"paddingRight":32,"itemSpacing":16}},
  {"type":"CREATE_TEXT","parentRef":"header","props":{"name":"Title","content":"Titulo","fontSize":24,"fontFamily":"Inter","fills":[{"type":"SOLID","color":{"r":1,"g":1,"b":1}}],"layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_FRAME","ref":"content","parentRef":"story","props":{"name":"Section/Content","layoutMode":"VERTICAL","layoutSizingHorizontal":"FILL","layoutSizingVertical":"FILL","paddingTop":32,"paddingLeft":32,"paddingRight":32,"itemSpacing":24}}
]`;

export const MULTIPLE_FRAMES_RULES = `MULTIPLOS ELEMENTOS (organize em sections):
Quando criar varios elementos do mesmo tipo (ex: 5 destaques, 3 slides):
1. Crie um FRAME container/section primeiro (layoutMode: "HORIZONTAL", itemSpacing: 40)
2. Crie os elementos como filhos do container (parentRef)
3. O auto-layout organiza automaticamente

EXEMPLO (5 destaques organizados):
[
  {"type":"CREATE_FRAME","ref":"section","props":{"name":"Section/Destaques","width":800,"height":200,"layoutMode":"HORIZONTAL","itemSpacing":24,"fills":[]}},
  {"type":"CREATE_FRAME","ref":"d1","parentRef":"section","props":{"name":"Destaque 1","width":100,"height":100,"cornerRadius":50,...}},
  {"type":"CREATE_FRAME","ref":"d2","parentRef":"section","props":{"name":"Destaque 2","width":100,"height":100,"cornerRadius":50,...}},
  ...
]

Frames ROOT (sem container) na pagina:
- Frame 1: x=0, y=0
- Frame 2+: x = largura_anterior + 40
Use MOVE: {"type":"MOVE","ref":"f2","x":400,"y":0}`;
