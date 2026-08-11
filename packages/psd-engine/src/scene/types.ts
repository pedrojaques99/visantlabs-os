// Scene Package format — the RAM/UX unlock.
//
// A SceneDoc is the result of pre-processing a PSD ONCE: it captures the
// geometry of each editable face (the quad to warp the art into) plus a small
// set of flattened layer images (base = everything below the faces, over =
// light/shadow layers above, with their blend mode + opacity annotated).
//
// Rendering a mockup from a SceneDoc is then a trivial compose (warp + blend)
// that runs on ANY canvas — the user's browser, a local CLI, or the server as a
// fallback — without ever opening (or shipping) the source PSD.

/** A quad of 4 corners (TL, TR, BR, BL) in document coordinates. */
export type Quad = [number, number, number, number, number, number, number, number];

/**
 * Uma ocorrência da face no documento — um smart object concreto.
 *
 * Uma face é um GRUPO de SOs que dividem o mesmo `linkId`: no Photoshop, editar
 * o conteúdo vinculado atualiza todos de uma vez, e o `replaceLinkedSmartObjects`
 * do compositor preenche todos. A cena guardava só o representante, então o
 * `paper-ghetto` perdia o `Mockup Overlay` (multiply, 0,5) que é irmão vinculado
 * da arte — e a arte saía sem a camada que a escurece.
 *
 * Cada instância tem geometria, máscara, blend e opacidade PRÓPRIOS. São
 * diferentes de propósito: é assim que o mesmo conteúdo vira frente e verso, ou
 * arte e overlay.
 */
export interface SceneFaceInstance {
  quad: Quad | null;
  origin?: { left: number; top: number };
  innerW: number;
  innerH: number;
  maskRef?: string;
  /** `globalCompositeOperation` já resolvido. */
  blendMode: string;
  /** Modo cru do Photoshop, para os que o Canvas 2D não tem. */
  psBlend?: string;
  opacity: number;
  dispRef?: string;
  dispScale?: number;
  /** Escala vertical, quando o Displace do PSD usa H e V diferentes. */
  dispVScale?: number;
  /**
   * `'inner'` = o mapa age no espaço INTERNO do smart object, ANTES do warp —
   * que é onde o `composePsd` sempre o aplicou (`replaceOne` desloca o
   * `artCanvas` e só depois deforma pro quad). Ausente = espaço da face, DEPOIS
   * do warp: é o que o pipeline de foto monta à mão (`photo-warp.ts`) e o que o
   * render WYSIWYG tem provado byte a byte. São ordens diferentes e dão imagens
   * diferentes; unificar no default mudaria o render de foto em silêncio.
   */
  dispSpace?: 'inner';
  dispMapMode?: 'stretch to fit' | 'tile';
  dispEdgeMode?: 'wrap around' | 'repeat edge pixels';
  /**
   * Warp de MALHA do Photoshop, quando a face tem um. É JSON puro (pontos de
   * controle + tamanho da grade), então viaja no `scene.json` sem asset extra —
   * ao contrário da máscara e do displacement, que são imagem.
   */
  mesh?: import('../mesh-warp.js').EnvelopeMesh;
}

export interface SceneFace {
  /** Stable key (linkId or representative path) — matches Face.key. */
  key: string;
  /** Short UI name ("Frente", "L", "Arte"). */
  name: string;
  /**
   * Corner quad in document space, or null when the placed layer had no
   * transform (art is drawn axis-aligned at innerW/innerH from `origin`).
   */
  quad: Quad | null;
  /** Axis-aligned placement origin (document px) used when `quad` is null. */
  origin?: { left: number; top: number };
  /** Internal art canvas size — the aspect ratio the art should be generated at. */
  innerW: number;
  innerH: number;
  /** Optional reference to a raster mask image in the asset map. */
  maskRef?: string;

  /**
   * Todas as ocorrências desta face. Ausente = documento antigo (ou o pipeline
   * de foto, que monta o `SceneDoc` na mão): o render cai nos campos soltos
   * acima, que descrevem exatamente uma instância. Quem escreve as duas formas
   * mantém os campos soltos iguais à PRIMEIRA instância.
   */
  instances?: SceneFaceInstance[];

  /**
   * `'doc'` = a máscara já está no espaço do DOCUMENTO (é o que a extração de
   * PSD produz, com o offset resolvido e a luminância virada alpha).
   * Ausente = comportamento antigo, em que a máscara é esticada pro tamanho do
   * canvas da face. O pipeline de foto depende do antigo — mudar o default
   * mexeria no render WYSIWYG, que é provado byte a byte.
   */
  maskSpace?: 'doc';
  /** Optional reference to a displacement map image in the asset map (R=X, G=Y, 128=neutral). */
  dispRef?: string;
  /** Displacement scale in pixels (applied symmetrically to H and V). Default 8. */
  dispScale?: number;
}

/**
 * LUT de 256 entradas por canal, serializável em JSON (o `Uint8Array` de
 * `RgbLut` não sobrevive ao `JSON.stringify` do SceneDoc).
 */
export interface SceneLut {
  r: number[];
  g: number[];
  b: number[];
}

export interface SceneLayer {
  /**
   * `base` = abaixo das faces (desenhado primeiro); `over` = acima
   * (luz/sombra); `adjust` = adjustment layer (Levels/Curves/Brightness).
   *
   * `adjust` não tem pixels próprios: aplica um LUT sobre tudo que já foi
   * composto abaixo — inclusive a arte da face. Antes ele virava um `over`
   * achatado sozinho, e achatar um adjustment sem nada embaixo produz canvas
   * vazio: o ajuste sumia em silêncio e a cena saía lavada (preto virando
   * cinza, contraste e saturação indo embora).
   */
  role: 'base' | 'over' | 'adjust';
  /** Reference into the asset map ({ ref: canvas|url }). Vazio quando role='adjust'. */
  src: string;
  /** Só para `role: 'adjust'`: a tabela a aplicar. */
  lut?: SceneLut;
  /**
   * A camada de recorte cuja base é o CONTAINER DA FACE não pode ter máscara
   * assada: no arquivo, o alpha do container é o do PLACEHOLDER (um canvas
   * pequeno, já aparado), e no render a face é preenchida pela arte no quad
   * inteiro. Medido no `Coffee Paper Cups`: a máscara assada cobria 0,41% do
   * quadro e apagava a sombra dos três copos. Este sinalizador manda o
   * `renderScene` recortar contra a silhueta das faces que ele acabou de
   * desenhar — a única que existe de verdade.
   */
  clipToFaces?: boolean;
  /**
   * Máscara raster: no `adjust` limita onde o ajuste age; no `over` é o
   * **recorte** (clipping) — a camada só pinta onde a base tem alpha.
   */
  maskRef?: string;
  /**
   * O modo do Photoshop, cru. `blendMode` é o `globalCompositeOperation`, e para
   * `linear burn`, `vivid light`, `divide`… o Canvas 2D **não tem equivalente** —
   * o `BLEND_MAP` só devolve a aproximação de CSS. O compositor sempre resolveu
   * esses no pixel; o `renderScene` usava a aproximação e por isso a caixa do
   * `boxes_scene_3` saía clara demais (`linear burn` virava `color-burn`).
   */
  psBlend?: string;
  /** Canvas-2D globalCompositeOperation already resolved from the PSD blend mode. */
  blendMode: string;
  /** 0..1 combined opacity * fillOpacity. */
  opacity: number;
  /** Top-left where the layer image is drawn (document px). Usually 0,0 (full-size). */
  left: number;
  top: number;
}

export interface SceneDoc {
  version: 1;
  width: number;
  height: number;
  faces: SceneFace[];
  layers: SceneLayer[];
  /** Blend modes / features encountered that the engine cannot reproduce 1:1 (fallback hints). */
  warnings: string[];
}

/** Map from a SceneLayer/SceneFace `src`/`maskRef` to a loaded image or canvas. */
export type AssetMap = Record<string, any>;
