# Loop de Melhoria de Prompts

## Como usar

```
1. Escolher STYLE + SUBJECT + LOGO RULE
2. Gerar via npm run gen:*
3. Avaliar resultado
4. Editar o .md relevante
5. Regenerar só o que mudou
```

## Composição de um prompt completo

```
[STYLE block]          ← styles/*.md
[LOGO INSTRUCTION]     ← logo-rules/*.md
[blank line]
Subject: [SUBJECT]     ← subjects/*.md
[detalhe específico da cena]
```

## Variáveis independentes para isolar

| Variável | Arquivo | Como testar |
|----------|---------|-------------|
| Estilo fotográfico | `styles/` | Mesmo sujeito, estilo diferente |
| Sujeito / esporte | `subjects/` | Mesmo estilo, sujeito diferente |
| Instrução de logo | `logo-rules/` | Mesmo tudo, só muda instrução |
| Size / aspect ratio | no script | Mesmo prompt, tamanho diferente |
| Modelo | `gen:*` | Comparar gpt-image-2 vs Gemini |

## Combinações que ainda faltam testar

### Prioridade alta
- [ ] `light-studio` + dartista (produto principal Sports 248)
- [ ] `light-studio` + kit branco → fundo cinza
- [ ] dois passes: gera produto → edita logo em cima

### Prioridade média  
- [ ] `dark-studio` + kit colorido (não navy)
- [ ] `cinematic` + golden hour + exterior real
- [ ] tamanho `1024x1024` para posts quadrados

### Prioridade baixa
- [ ] múltiplos atletas na mesma cena
- [ ] comparar `Simbolo.png` vs `Logo completa.png` como referência

## Critérios de avaliação (1-5)

| Critério | O que avaliar |
|----------|--------------|
| **Qualidade técnica** | Nitidez, iluminação, realismo |
| **Estilo** | Ghost correto? Fundo certo? |
| **Logo** | Aparece? É fiel? Está na posição? |
| **Sujeito** | Pose dinâmica? Roupa correta? |
| **Uso comercial** | Parece campanha real de marca? |

## Registro de iterações

| Data | Style | Subject | Logo Rule | Score | Notas |
|------|-------|---------|-----------|-------|-------|
| 2026-04-23 | dark-studio | sprinter | watermark-dark | 3/5 | Logo alucinou — bug images.edit |
| 2026-04-23 | light-studio | sprinter | watermark-light | 4/5 | Fix aplicado, logo ~70% fiel |
| 2026-04-23 | cinematic | kit-bag | apparel | 3/5 | Logo inconsistente em produto 3D |
