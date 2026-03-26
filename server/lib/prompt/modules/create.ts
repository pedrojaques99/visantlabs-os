/**
 * Module: Create Intent
 *
 * Rules and examples for creation operations.
 */

export const CREATE_RULES = `CRIACAO:
- Primeiro CREATE_FRAME (ref), depois filhos (parentRef)
- layoutSizingHorizontal: "FILL" para textos expandirem
- textAutoResize: "HEIGHT" para texto quebrar linha
- cornerRadius + cornerSmoothing: 0.6 para bordas iOS
- Nomeie semanticamente: "Card/Header", "Button/Primary"`;

export const CREATE_EXAMPLE = `EXEMPLO (card simples):
[
  {"type":"CREATE_FRAME","ref":"card","props":{"name":"Card","width":340,"height":200,"layoutMode":"VERTICAL","itemSpacing":16,"paddingTop":24,"paddingRight":24,"paddingBottom":24,"paddingLeft":24,"fills":[{"type":"SOLID","color":{"r":1,"g":1,"b":1}}],"cornerRadius":16}},
  {"type":"CREATE_TEXT","parentRef":"card","props":{"name":"Title","content":"Titulo","fontSize":18,"fontFamily":"Inter","fontStyle":"Semi Bold","fills":[{"type":"SOLID","color":{"r":0.1,"g":0.1,"b":0.1}}],"layoutSizingHorizontal":"FILL"}}
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
