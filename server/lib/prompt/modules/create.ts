/**
 * Module: Create Intent
 *
 * Rules and examples for creation operations.
 */

export const CREATE_RULES = `CRIACAO:
- Primeiro CREATE_FRAME (ref), depois filhos (parentRef)
- Frame ROOT: sempre width + height explicitos
- Frame FILHO: use layoutSizingHorizontal:"FILL" ou "HUG" (sem width/height)
- layoutPositioning: "ABSOLUTE" (ESSENCIAL para elipses/blobs decorativos e logos flutuantes dentro de frames com Auto Layout)
- textAutoResize: "HEIGHT" para texto quebrar linha
- cornerRadius + cornerSmoothing: 0.6 para bordas iOS
- Nomeie semanticamente: "Section/Header", "Card/Body", "Button/Primary"`;

export const CREATE_EXAMPLE = `EXEMPLO (Slide Premium):
[
  {"type":"CREATE_FRAME","ref":"slide","props":{"name":"Slide/Premium","width":1080,"height":1080,"layoutMode":"VERTICAL","primaryAxisAlignItems":"CENTER","counterAxisAlignItems":"CENTER","itemSpacing":40,"paddingTop":100,"paddingBottom":100,"fills":[{"type":"SOLID","color":{"r":0.05,"g":0.05,"b":0.1}}]}},
  {"type":"CREATE_ELLIPSE","parentRef":"slide","props":{"name":"Blob/Decorative","width":800,"height":800,"x":140,"y":140,"fills":[{"type":"SOLID","color":{"r":0.4,"g":0.2,"b":0.9},"opacity":0.2}],"effects":[{"type":"LAYER_BLUR","radius":150}],"layoutPositioning":"ABSOLUTE"}},
  {"type":"CREATE_COMPONENT_INSTANCE","parentRef":"slide","props":{"name":"Logo/Floating","symbolKey":"BRAND_LOGO_KEY","width":120,"height":60,"x":900,"y":60,"layoutPositioning":"ABSOLUTE"}},
  {"type":"CREATE_TEXT","parentRef":"slide","props":{"name":"Title","content":"CONSTRUIR AÍ 2026","fontSize":120,"fontFamily":"Barlow","fontStyle":"Bold","fills":[{"type":"SOLID","color":{"r":1,"g":1,"b":1}}],"textAlignHorizontal":"CENTER","layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_TEXT","parentRef":"slide","props":{"name":"Subtitle","content":"A REVOLUÇÃO DO DESIGN AGENTIC","fontSize":32,"fontFamily":"Barlow","fontStyle":"Regular","fills":[{"type":"SOLID","color":{"r":0.8,"g":0.8,"b":0.9}}],"textAlignHorizontal":"CENTER"}}
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
