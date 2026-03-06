# Visant Copilot — Plano de Melhoria Completo
 
> Gerado em: 2026-03-03
> Stack: Figma Plugin (sandbox + UI) → Vercel API Routes → MongoDB → Claude/Gemini
> Target: até 300 ops/request, subscription model, progressive UI
 
---
+ 
+## Resumo Executivo
+ 
+O plugin hoje tem 21 operações, suporta auto-layout, variáveis de cor/fonte, componentes da library,
+e brand guidelines com persistência. A base é sólida mas faltam capabilities críticas:
+**gradientes, imagens, criação de componentes, SVG, chat com memória, e rich text**.
+ 
+Este plano está dividido em **4 fases** priorizadas por impacto + dependência técnica.
+ 
+---
+ 
+## FASE 1 — Foundation & Critical Fixes (Semana 1-2)
+ 
+### 1.1 Fix Performance: Font Loading O(n) → O(segments)
+ 
+**Problema:** `SET_TEXT_CONTENT` itera char-by-char para descobrir fontes.
+**Solução:**
+ 
+```typescript
+// ANTES (O(n) por caractere — LENTO)
+for (let i = 0; i < len; i++) {
+  const fn = node.getRangeFontName(i, i + 1) as FontName;
+  // ...
+}
+ 
+// DEPOIS (O(segments) — RÁPIDO)
+const segments = node.getStyledTextSegments(['fontName']);
+const fontsUsed: FontName[] = [];
+const seen = new Set<string>();
+for (const seg of segments) {
+  const key = `${seg.fontName.family}::${seg.fontName.style}`;
+  if (!seen.has(key)) {
+    seen.add(key);
+    fontsUsed.push(seg.fontName);
+    try { await figma.loadFontAsync(seg.fontName); } catch (_e) {}
+  }
+}
+```
+ 
+**Arquivos:** `src/code.ts` linhas 416-429
+ 
+---
+ 
+### 1.2 Fix Performance: Cache loadAllPagesAsync
+ 
+**Problema:** `CREATE_COMPONENT_INSTANCE` chama `loadAllPagesAsync()` em CADA instância.
+**Solução:** Cache no nível da sessão de operações.
+ 
+```typescript
+let pagesLoaded = false;
+ 
+async function ensurePagesLoaded() {
+  if (!pagesLoaded) {
+    await figma.loadAllPagesAsync();
+    pagesLoaded = true;
+  }
+}
+```
+ 
+**Arquivos:** `src/code.ts` linha 288
+ 
+---
+ 
+### 1.3 Expandir Paint Types: Gradientes
+ 
+**Problema:** `SolidPaint` é o único tipo suportado. Gradientes são impossíveis.
+**Solução:** Criar union type `FigmaPaint`:
+ 
+```typescript
+// figma-types.ts
+export type GradientStop = {
+  position: number; // 0-1
+  color: { r: number; g: number; b: number; a: number };
+};
+ 
+export type GradientPaint = {
+  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
+  gradientStops: GradientStop[];
+  gradientTransform?: [[number, number, number], [number, number, number]];
+  opacity?: number;
+};
+ 
+export type ImagePaint = {
+  type: 'IMAGE';
+  imageUrl?: string;  // URL para createImageAsync
+  imageHash?: string; // hash direto se já existe
+  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
+  opacity?: number;
+};
+ 
+export type FigmaPaint = SolidPaint | GradientPaint | ImagePaint;
+```
+ 
+**Impacto:** Todos os campos `fills` e `strokes` mudam de `SolidPaint[]` para `FigmaPaint[]`.
+ 
+**No executor (code.ts):**
+```typescript
+function resolvePaints(paints: FigmaPaint[]): Paint[] {
+  return paints.map(p => {
+    if (p.type === 'SOLID') {
+      return { type: 'SOLID', color: p.color, opacity: p.opacity ?? 1 };
+    }
+    if (p.type.startsWith('GRADIENT_')) {
+      return {
+        type: p.type,
+        gradientStops: p.gradientStops.map(s => ({
+          position: s.position,
+          color: { ...s.color }
+        })),
+        gradientTransform: p.gradientTransform ?? [[1, 0, 0], [0, 1, 0]],
+        opacity: p.opacity ?? 1,
+      };
+    }
+    if (p.type === 'IMAGE' && p.imageUrl) {
+      // Handled async — see SET_IMAGE_FILL operation
+    }
+    return p as any;
+  });
+}
+```
+ 
+**Arquivos:** `src/lib/figma-types.ts`, `src/code.ts`
+ 
+---
+ 
+### 1.4 Nova Operação: SET_IMAGE_FILL
+ 
+```typescript
+// figma-types.ts — adicionar ao union FigmaOperation
+| {
+  type: 'SET_IMAGE_FILL';
+  nodeId?: string;       // editar nó existente
+  ref?: string;          // ou referência a nó criado
+  imageUrl: string;      // URL pública da imagem
+  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
+}
+```
+ 
+**No executor:**
+```typescript
+} else if (op.type === 'SET_IMAGE_FILL') {
+  const node = op.nodeId
+    ? await figma.getNodeByIdAsync(op.nodeId)
+    : (op.ref ? createdNodes.get(op.ref) : null);
+  if (node && 'fills' in node) {
+    const image = await figma.createImageAsync(op.imageUrl);
+    (node as GeometryMixin).fills = [{
+      type: 'IMAGE',
+      imageHash: image.hash,
+      scaleMode: op.scaleMode || 'FILL',
+    }];
+    summaryLines.push(`Imagem aplicada @"${(node as any).name}"`);
+  }
+}
+```
+ 
+**Atenção:** `figma.createImageAsync(url)` requer que o domínio esteja em `networkAccess.allowedDomains` no manifest. Adicionar domínios de CDN comuns (unsplash, pexels, cloudinary) ou proxy via server.
+ 
+---
+ 
+### 1.5 Serialização Expandida
+ 
+**Problema:** Serialização ignora gradientes, strokes, effects, opacity, constraints.
+**Solução:** Enriquecer `serializeNode`:
+ 
+```typescript
+// Adicionar ao serializeNode():
+ 
+// Strokes
+if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
+  base.strokes = (node.strokes as ReadonlyArray<Paint>).map(serializePaint);
+  if ('strokeWeight' in node) base.strokeWeight = (node as any).strokeWeight;
+}
+ 
+// Effects
+if ('effects' in node && Array.isArray((node as any).effects) && (node as any).effects.length > 0) {
+  base.effects = (node as any).effects.map((e: Effect) => ({
+    type: e.type,
+    radius: 'radius' in e ? e.radius : undefined,
+    color: 'color' in e ? e.color : undefined,
+    offset: 'offset' in e ? e.offset : undefined,
+  }));
+}
+ 
+// Opacity
+if ('opacity' in node && (node as any).opacity !== 1) {
+  base.opacity = (node as any).opacity;
+}
+ 
+// Constraints (non-auto-layout)
+if ('constraints' in node) {
+  base.constraints = (node as any).constraints;
+}
+ 
+// layoutSizing (for children of auto-layout)
+if ('layoutSizingHorizontal' in node) {
+  base.layoutSizingHorizontal = (node as any).layoutSizingHorizontal;
+  base.layoutSizingVertical = (node as any).layoutSizingVertical;
+}
+```
+ 
+**Também** aumentar profundidade de 3 → 5 para designs complexos.
+ 
+---
+ 
+### 1.6 Undo Grouping
+ 
+```typescript
+// Wrap applyOperations em um único undo group
+async function applyOperations(ops: FigmaOperation[]) {
+  // Figma agrupa automaticamente operações dentro de um mesmo handler
+  // Mas para garantir, podemos usar:
+  // figma.skipInvisibleInstanceChildren = true; // performance
+ 
+  const createdNodes = new Map<string, SceneNode>();
+  // ... resto do código
+}
+```
+ 
+**Nota:** Figma automaticamente agrupa ops dentro de um `figma.ui.onmessage` handler como 1 undo step. Documentar isso para o time.
+ 
+---
+ 
+## FASE 2 — Advanced Creation (Semana 3-4)
+ 
+### 2.1 Nova Operação: CREATE_COMPONENT
+ 
+```typescript
+| {
+  type: 'CREATE_COMPONENT';
+  ref?: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  props: {
+    name: string;
+    width: number;
+    height: number;
+    description?: string;
+    fills?: FigmaPaint[];
+    cornerRadius?: number;
+    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
+    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
+    counterAxisSizingMode?: 'FIXED' | 'AUTO';
+    primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN';
+    counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';
+    itemSpacing?: number;
+    paddingTop?: number;
+    paddingRight?: number;
+    paddingBottom?: number;
+    paddingLeft?: number;
+    layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
+    layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
+  };
+}
+```
+ 
+**Executor:**
+```typescript
+} else if (op.type === 'CREATE_COMPONENT') {
+  const parent = await getParent(op.parentRef, op.parentNodeId);
+  const comp = figma.createComponent();
+  comp.name = op.props.name;
+  comp.resize(op.props.width || 100, op.props.height || 100);
+  if (op.props.description) comp.description = op.props.description;
+  // ... mesma lógica de fills, cornerRadius, auto-layout que CREATE_FRAME
+  parent.appendChild(comp);
+  if (op.ref) createdNodes.set(op.ref, comp);
+}
+```
+ 
+---
+ 
+### 2.2 Nova Operação: COMBINE_AS_VARIANTS
+ 
+```typescript
+| {
+  type: 'COMBINE_AS_VARIANTS';
+  ref?: string;
+  componentRefs: string[];  // refs de CREATE_COMPONENT anteriores
+  name: string;
+}
+```
+ 
+**Executor:**
+```typescript
+} else if (op.type === 'COMBINE_AS_VARIANTS') {
+  const components: ComponentNode[] = [];
+  for (const ref of op.componentRefs) {
+    const node = createdNodes.get(ref);
+    if (node && node.type === 'COMPONENT') components.push(node as ComponentNode);
+  }
+  if (components.length >= 1) {
+    const parent = components[0].parent as BaseNode & ChildrenMixin;
+    const set = figma.combineAsVariants(components, parent);
+    set.name = op.name;
+    if (op.ref) createdNodes.set(op.ref, set);
+  }
+}
+```
+ 
+---
+ 
+### 2.3 Nova Operação: CREATE_SVG
+ 
+```typescript
+| {
+  type: 'CREATE_SVG';
+  ref?: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  svgString: string;
+  name?: string;
+  width?: number;
+  height?: number;
+}
+```
+ 
+**Executor:**
+```typescript
+} else if (op.type === 'CREATE_SVG') {
+  const parent = await getParent(op.parentRef, op.parentNodeId);
+  const svgFrame = figma.createNodeFromSvg(op.svgString);
+  if (op.name) svgFrame.name = op.name;
+  if (op.width && op.height) svgFrame.resize(op.width, op.height);
+  parent.appendChild(svgFrame);
+  if (op.ref) createdNodes.set(op.ref, svgFrame);
+}
+```
+ 
+**Nota sobre SVG:** O AI pode gerar SVG inline para ícones simples (setas, checkmarks, hamburger menu, etc). Para ícones complexos, melhor usar componentes da library.
+ 
+---
+ 
+### 2.4 Novas Operações: CREATE_LINE, CREATE_POLYGON, CREATE_STAR
+ 
+```typescript
+| {
+  type: 'CREATE_LINE';
+  ref?: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  props: { name: string; width: number; strokes?: FigmaPaint[]; strokeWeight?: number; };
+}
+| {
+  type: 'CREATE_POLYGON';
+  ref?: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  props: { name: string; width: number; height: number; pointCount: number; fills?: FigmaPaint[]; };
+}
+| {
+  type: 'CREATE_STAR';
+  ref?: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  props: { name: string; width: number; height: number; pointCount: number; fills?: FigmaPaint[]; innerRadius?: number; };
+}
+```
+ 
+---
+ 
+### 2.5 Nova Operação: SET_TEXT_RANGES (Rich Text)
+ 
+```typescript
+| {
+  type: 'SET_TEXT_RANGES';
+  nodeId: string;
+  ranges: Array<{
+    start: number;
+    end: number;
+    fontFamily?: string;
+    fontStyle?: string;
+    fontSize?: number;
+    fills?: FigmaPaint[];
+    textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
+    textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
+    letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
+    lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
+  }>;
+}
+```
+ 
+---
+ 
+### 2.6 Propriedades Faltantes em Operações Existentes
+ 
+**Adicionar a CREATE_FRAME:**
+```typescript
+counterAxisSpacing?: number;       // gap entre linhas de wrap
+strokesIncludedInLayout?: boolean; // border-box
+minWidth?: number;
+maxWidth?: number;
+minHeight?: number;
+maxHeight?: number;
+```
+ 
+**Adicionar a CREATE_TEXT:**
+```typescript
+textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
+textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
+paragraphSpacing?: number;
+```
+ 
+**Adicionar a CREATE_RECTANGLE e CREATE_ELLIPSE:**
+```typescript
+effects?: FigmaEffect[];
+constraints?: { horizontal: string; vertical: string };
+```
+ 
+**Adicionar a SET_AUTO_LAYOUT:**
+```typescript
+counterAxisSpacing?: number;
+strokesIncludedInLayout?: boolean;
+layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
+layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
+```
+ 
+---
+ 
+## FASE 3 — Intelligence & Memory (Semana 5-6)
+ 
+### 3.1 Multi-Model Architecture
+ 
+**Estratégia:** Claude para reasoning/planning complexo, Gemini para execução rápida.
+Abstração no server com fallback automático.
+ 
+```
+server/lib/ai-providers/
+├── types.ts          # interface AIProvider
+├── claude.ts         # Claude Sonnet via Anthropic SDK
+├── gemini.ts         # Gemini 2.5 Flash (atual)
+├── router.ts         # Escolhe provider baseado em complexidade
+└── index.ts          # export
+```
+ 
+**Interface:**
+```typescript
+// types.ts
+interface AIProvider {
+  name: string;
+  generateOperations(
+    systemPrompt: string,
+    userPrompt: string,
+    options?: { temperature?: number; maxTokens?: number }
+  ): Promise<FigmaOperation[]>;
+}
+```
+ 
+**Router inteligente:**
+```typescript
+// router.ts
+function chooseProvider(command: string, contextSize: number): AIProvider {
+  // Heurísticas:
+  // 1. Comando complexo (>100 chars, múltiplas instruções) → Claude
+  // 2. Edição simples (mudar cor, resize) → Gemini (mais rápido)
+  // 3. Criação de página inteira → Claude (melhor reasoning)
+  // 4. Context muito grande (>50 elementos) → Claude (melhor context window)
+ 
+  const isComplex = command.length > 100
+    || command.includes(' e ')
+    || command.includes('página')
+    || command.includes('seção')
+    || contextSize > 30;
+ 
+  return isComplex ? claudeProvider : geminiProvider;
+}
+```
+ 
+**Claude Provider:**
+```typescript
+// claude.ts
+import Anthropic from '@anthropic-ai/sdk';
+ 
+const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
+ 
+async function generateOperations(systemPrompt, userPrompt, options) {
+  const response = await client.messages.create({
+    model: 'claude-sonnet-4-6',
+    max_tokens: 8192,
+    system: systemPrompt,
+    messages: [{ role: 'user', content: userPrompt }],
+    // Usar tool_use para structured output:
+    tools: [{
+      name: 'apply_figma_operations',
+      description: 'Aplica operações no Figma',
+      input_schema: {
+        type: 'object',
+        properties: {
+          operations: {
+            type: 'array',
+            items: { /* FigmaOperation schema */ }
+          }
+        }
+      }
+    }],
+    tool_choice: { type: 'tool', name: 'apply_figma_operations' }
+  });
+  // Parse tool_use response
+}
+```
+ 
+---
+ 
+### 3.2 Chat com Memória (MongoDB Sessions)
+ 
+**Schema MongoDB:**
+```typescript
+// models/PluginSession.ts
+interface PluginSession {
+  _id: string;           // sessionId (gerado pelo plugin)
+  userId: string;        // do subscription
+  fileId: string;        // figma file key
+  messages: Array<{
+    role: 'user' | 'assistant';
+    content: string;
+    operations?: FigmaOperation[];
+    createdNodeRefs?: Record<string, string>; // ref → nodeId
+    timestamp: Date;
+  }>;
+  context: {
+    lastSelection?: SerializedNode[];
+    brandGuidelines?: BrandGuideline;
+  };
+  createdAt: Date;
+  updatedAt: Date;
+  expiresAt: Date;       // TTL: 24h após última interação
+}
+```
+ 
+**Fluxo:**
+1. Plugin envia `sessionId` (gerado em `ui.js` com `crypto.randomUUID()`)
+2. Server busca/cria session no MongoDB
+3. Injeta últimas 10 mensagens no prompt do AI
+4. Após gerar operações, salva resposta na session
+5. `createdNodeRefs` mapeia refs para IDs reais (retornados pelo sandbox)
+ 
+**Mudanças no plugin:**
+```typescript
+// ui.js — adicionar ao estado
+let sessionId = crypto.randomUUID();
+ 
+// Em sendChat(), adicionar sessionId ao context
+parent.postMessage({
+  pluginMessage: {
+    type: 'GENERATE_WITH_CONTEXT',
+    command,
+    sessionId,  // NOVO
+    // ...
+  }
+}, 'https://www.figma.com');
+```
+ 
+**Mudanças no server:**
+```typescript
+// POST /api/plugin
+const session = await PluginSession.findOneAndUpdate(
+  { _id: req.body.sessionId },
+  { $setOnInsert: { createdAt: new Date() }, $set: { updatedAt: new Date() } },
+  { upsert: true, returnDocument: 'after' }
+);
+ 
+// Injetar histórico no prompt
+const historyContext = session.messages.slice(-10).map(m =>
+  `[${m.role.toUpperCase()}]: ${m.content}`
+).join('\n');
+ 
+// Após gerar ops, salvar na session
+await PluginSession.updateOne(
+  { _id: sessionId },
+  { $push: { messages: { role: 'user', content: command, timestamp: new Date() } } }
+);
+// ... após obter operações do AI:
+await PluginSession.updateOne(
+  { _id: sessionId },
+  { $push: { messages: { role: 'assistant', content: aiMessage, operations, timestamp: new Date() } } }
+);
+```
+ 
+**Novo message type para retornar IDs criados:**
+```typescript
+// Sandbox → UI
+| { type: 'NODES_CREATED'; nodeMap: Record<string, string> } // ref → realNodeId
+ 
+// UI posta de volta para server
+fetch('/api/plugin/session', {
+  method: 'PATCH',
+  body: JSON.stringify({ sessionId, nodeMap })
+});
+```
+ 
+---
+ 
+### 3.3 Prompt Engineering Melhorado
+ 
+**Novo formato de system prompt com seções expandidas:**
+ 
+1. **Histórico de conversa** (novo)
+2. **Brand guidelines** (existente, melhorado)
+3. **Context do arquivo** (existente, com gradientes/strokes/effects)
+4. **Operações disponíveis** (expandido: ~30 tipos)
+5. **Regras de ouro** (expandido para ~25 regras)
+6. **Exemplos** (múltiplos exemplos por complexidade)
+ 
+**Novas golden rules a adicionar:**
+```
+16. GRADIENTES: Use gradientStops com positions 0-1. Transform padrão para linear
+    horizontal: [[1,0,0],[0,1,0]]. Para diagonal: [[0.7,0.7,-0.1],[−0.7,0.7,0.5]].
+17. IMAGENS: Use SET_IMAGE_FILL com URLs de placeholder (unsplash/picsum).
+    Para cards com foto: crie RECTANGLE como container, aplique SET_IMAGE_FILL.
+18. COMPONENTES: Use CREATE_COMPONENT para elementos reutilizáveis.
+    Variants via COMBINE_AS_VARIANTS com naming "Property=Value".
+19. SVG: Use CREATE_SVG para ícones simples. Gere SVG inline com viewBox correto.
+    Preferir componentes da library quando disponíveis.
+20. RICH TEXT: Para textos com formatação mista, use CREATE_TEXT seguido de SET_TEXT_RANGES.
+21. CONSTRAINTS: Em frames sem auto-layout, sempre setar constraints.
+    Buttons: horizontal STRETCH, vertical MIN.
+22. SIZE CONSTRAINTS: Use minWidth/maxWidth para auto-layout responsivo.
+23. MEMÓRIA: Consulte o histórico de conversa. Se o user referencia algo que criamos antes,
+    use os nodeIds do histórico.
+24. IMAGENS PLACEHOLDER: Quando o design pede imagens, use URLs no formato:
+    https://picsum.photos/{width}/{height}?random={n}
+25. PROGRESSIVIDADE: Para designs grandes, organize em seções lógicas.
+    Cada seção é um frame auto-layout independente.
+```
+ 
+---
+ 
+## FASE 4 — Polish & Advanced Features (Semana 7-8)
+ 
+### 4.1 Nova Operação: CLONE_NODE
+ 
+```typescript
+| {
+  type: 'CLONE_NODE';
+  ref?: string;
+  sourceNodeId: string;
+  parentRef?: string;
+  parentNodeId?: string;
+  overrides?: {
+    name?: string;
+    fills?: FigmaPaint[];
+    width?: number;
+    height?: number;
+  };
+}
+```
+ 
+### 4.2 Nova Operação: REORDER_CHILD
+ 
+```typescript
+| {
+  type: 'REORDER_CHILD';
+  nodeId: string;
+  parentNodeId: string;
+  index: number; // posição desejada (0-based)
+}
+```
+ 
+**Executor:** `parent.insertChild(index, node)`
+ 
+### 4.3 Nova Operação: SET_CONSTRAINTS
+ 
+```typescript
+| {
+  type: 'SET_CONSTRAINTS';
+  nodeId: string;
+  horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
+  vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
+}
+```
+ 
+### 4.4 Nova Operação: SET_LAYOUT_GRID
+ 
+```typescript
+| {
+  type: 'SET_LAYOUT_GRID';
+  nodeId: string;
+  grids: Array<{
+    pattern: 'COLUMNS' | 'ROWS' | 'GRID';
+    alignment?: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER';
+    count?: number;
+    gutterSize?: number;
+    sectionSize?: number;
+    offset?: number;
+    color?: { r: number; g: number; b: number; a: number };
+    visible?: boolean;
+  }>;
+}
+```
+ 
+### 4.5 Nova Operação: CREATE_VARIABLE
+ 
+```typescript
+| {
+  type: 'CREATE_VARIABLE';
+  ref?: string;
+  collectionName: string; // busca existente ou cria
+  name: string;
+  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
+  value: any; // depende do type
+}
+```
+ 
+### 4.6 Nova Operação: SET_BLEND_MODE
+ 
+```typescript
+| {
+  type: 'SET_BLEND_MODE';
+  nodeId: string;
+  blendMode: 'NORMAL' | 'MULTIPLY' | 'SCREEN' | 'OVERLAY' | 'DARKEN' | 'LIGHTEN'
+    | 'COLOR_DODGE' | 'COLOR_BURN' | 'HARD_LIGHT' | 'SOFT_LIGHT' | 'DIFFERENCE'
+    | 'EXCLUSION' | 'HUE' | 'SATURATION' | 'COLOR' | 'LUMINOSITY';
+}
+```
+ 
+### 4.7 Nova Operação: SET_INDIVIDUAL_CORNERS
+ 
+```typescript
+| {
+  type: 'SET_INDIVIDUAL_CORNERS';
+  nodeId: string;
+  topLeftRadius?: number;
+  topRightRadius?: number;
+  bottomLeftRadius?: number;
+  bottomRightRadius?: number;
+  cornerSmoothing?: number;
+}
+```
+ 
+### 4.8 Nova Operação: SET_BOOLEAN_OPERATION
+ 
+```typescript
+| {
+  type: 'BOOLEAN_OPERATION';
+  ref?: string;
+  operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE';
+  nodeIds: string[]; // ou refs
+  nodeRefs?: string[];
+  name?: string;
+}
+```
+ 
+### 4.9 UI Improvements
+ 
+**Manter vanilla JS** (alinhado com Figma native components), mas refatorar:
+ 
+```
+ui/
+├── ui.html          # Estrutura (mantém)
+├── ui.css           # Estilos (mantém Figma design tokens)
+├── ui.js            # Entry point (refatorado)
+├── modules/
+│   ├── state.js     # Estado centralizado com event emitter
+│   ├── chat.js      # Chat rendering + envio
+│   ├── brand.js     # Brand guidelines, logo, cores, fontes
+│   ├── library.js   # Component library + folder tree
+│   └── api.js       # API calls + error handling
+```
+ 
+**Progressive Disclosure na UI:**
+- **Modo Simples** (default): Só chat + brand pill. AI decide tudo.
+- **Modo Avançado** (toggle): Mostra operations log, JSON preview, modelo de AI.
+ 
+---
+ 
+## Contagem Final de Operações
+ 
+### Hoje: 21 operações
+### Após todas as fases: ~35 operações
+ 
+| Categoria | Operações Atuais | Novas |
+|-----------|-----------------|-------|
+| **Criação** | 5 (frame, rect, ellipse, text, instance) | +6 (component, svg, line, polygon, star, variable) |
+| **Edição** | 10 (fill, stroke, radius, effects, layout, resize, move, rename, text, opacity) | +6 (image_fill, text_ranges, constraints, layout_grid, blend_mode, individual_corners) |
+| **Tokens** | 2 (variable, style) | — |
+| **Estrutura** | 4 (group, ungroup, detach, delete) | +3 (clone, reorder, boolean_op) |
+| **Variants** | — | +1 (combine_as_variants) |
+| **Total** | **21** | **+16 = 37** |
+ 
+---
+ 
+## Prioridade de Implementação
+ 
+```
+FASE 1 (Semana 1-2) — FOUNDATION
+├── [P0] Fix font loading performance
+├── [P0] Fix loadAllPagesAsync cache
+├── [P0] Gradient paint types
+├── [P0] SET_IMAGE_FILL operation
+├── [P0] Serialização expandida
+└── [P1] Undo grouping
+ 
+FASE 2 (Semana 3-4) — ADVANCED CREATION
+├── [P0] CREATE_COMPONENT
+├── [P0] COMBINE_AS_VARIANTS
+├── [P0] CREATE_SVG
+├── [P1] CREATE_LINE/POLYGON/STAR
+├── [P1] SET_TEXT_RANGES (rich text)
+└── [P1] Propriedades faltantes em ops existentes
+ 
+FASE 3 (Semana 5-6) — INTELLIGENCE
+├── [P0] Multi-model (Claude + Gemini)
+├── [P0] Chat com memória (MongoDB sessions)
+├── [P0] Prompt engineering expandido
+└── [P1] Node ID mapping para referências do chat
+ 
+FASE 4 (Semana 7-8) — POLISH
+├── [P1] CLONE_NODE, REORDER_CHILD
+├── [P1] SET_CONSTRAINTS, SET_LAYOUT_GRID
+├── [P1] CREATE_VARIABLE, SET_BLEND_MODE
+├── [P2] SET_INDIVIDUAL_CORNERS, BOOLEAN_OPERATION
+└── [P2] UI refactor (modules) + progressive disclosure
+```
+ 
+---
+ 
+## Manifest Changes Necessárias
+ 
+```json
+{
+  "networkAccess": {
+    "allowedDomains": [
+      "https://www.visantlabs.com",
+      "https://visantlabs.com",
+      "https://images.unsplash.com",
+      "https://picsum.photos",
+      "https://fastly.picsum.photos",
+      "https://res.cloudinary.com"
+    ]
+  }
+}
+```
+ 
+---
+ 
+## Riscos e Mitigações
+ 
+| Risco | Mitigação |
+|-------|-----------|
+| AI gera JSON inválido com 300 ops | Validação robusta + fallback: re-tentar com prompt simplificado |
+| createImageAsync falha (CORS/URL) | Proxy de imagens via server: `/api/proxy-image?url=...` |
+| Custo de Claude para 300 ops/request | Router inteligente: Claude só para requests complexos, Gemini para simples |
+| Session MongoDB cresce demais | TTL de 24h + limit de 50 mensagens por session |
+| SVG strings muito grandes no JSON | Limit de 10KB por SVG + fallback para componentes |
+| Font loading lento com muitas fontes | Cache de fontes carregadas por sessão + batch loading |
+ 
+---
+ 
+## Métricas de Sucesso
+ 
+- **Latência p95**: < 8s para requests simples, < 15s para páginas completas
+- **Taxa de sucesso de operações**: > 95% (hoje estimada ~85%)
+- **Operações por request**: média de 30-50, max 300
+- **Cobertura de Figma API**: de ~40% (hoje) para ~75% (após fase 4)
+- **Retenção de sessão**: users que enviam >3 mensagens na mesma sessão > 60%
+ 