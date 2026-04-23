# Lessons Learned — Sports 248 Image Generation
> Essentialista. Só o que importa, só o que funcionou.

---

## O que funciona vs o que falha

### ✅ Funciona
| Padrão | Motivo |
|--------|--------|
| `LOGO INSTRUCTION: The first attached image is the exact brand logo...` | Ancora o modelo à imagem de ref antes de qualquer instrução |
| Separar STYLE (base) + SUBJECT (cena) em blocos distintos | Composição modular — troca de sujeito sem quebrar o estilo |
| `images.edit` sempre que há referenceImages | gpt-image-2 só vê a imagem se entrar pelo endpoint certo |
| Descrever background, lighting, effect, logo em linhas separadas | Modelo processa cada dimensão independentemente |
| `Photorealistic, commercial quality` no final | Âncora de qualidade — levanta o nível geral da saída |

### ❌ Falha / Aprendi da forma dura
| Erro | Consequência | Fix |
|------|-------------|-----|
| Logo como `referenceImages` sem `baseImage` → cai em `images.generate` | Logo ignorado, modelo alucina logo novo | Entrar em `images.edit` se `referenceImages.length > 0` |
| `"The brand logo from the reference image..."` como única instrução | Modelo ignora, cria logo próprio | Usar `LOGO INSTRUCTION:` explícito como primeira linha |
| Descrever o logo no prompt (forma, cores, tipografia) | Modelo interpreta como spec para criar um novo | Nunca descrever — só injetar como imagem |
| `output_format: 'url'` no gpt-image-1 | API rejeita — só aceita `png/webp/jpeg` | `output_format: 'png'` + salvar b64 local |
| `gpt-image-1` como model string | Modelo errado, qualidade inferior | `gpt-image-2` |

---

## Regras permanentes (não negociáveis)

```
1. Logo → base64 como referenceImages, NUNCA descrito no prompt
2. Usar images.edit sempre que há referenceImages
3. LOGO INSTRUCTION como primeira linha do prompt quando logo é watermark
4. STYLE separado de SUBJECT — composição modular
5. Rotear pelo /api/mockups/generate — nunca direto na OpenAI
```

---

## Estrutura de arquivos

```
scripts/prompts/
├── LESSONS-LEARNED.md     ← este arquivo
├── styles/                ← blocos de estilo reutilizáveis
│   ├── dark-studio.md
│   ├── light-studio.md
│   └── cinematic-lifestyle.md
├── subjects/              ← cenas de sujeito intercambiáveis
│   └── sports248-athletes.md
└── logo-rules/            ← instruções de logo por contexto
    ├── watermark.md
    ├── apparel.md
    └── product.md
```

---

## Loop de melhoria

```
Gerar → Ver resultado → Identificar o que falhou → Editar .md relevante → Regenerar
```

Cada arquivo `.md` = uma variável isolada. Muda um, mantém o resto fixo.
