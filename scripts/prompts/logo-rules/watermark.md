# Logo Rule: Watermark (canto da imagem)
> Contexto: atletas, editorial, campanha — logo pequeno no canto

## Instrução (colar no final do STYLE block)

```
LOGO INSTRUCTION: The first attached image is the exact brand logo. Place it small in the bottom-left corner as a watermark, reproduced exactly as shown — same icon and same text, same proportions. Do not invent or modify the logo.
```

### Variante dark background (cyan tint)
```
LOGO INSTRUCTION: The first attached image is the exact brand logo. Place it small in the bottom-left corner as a watermark — reproduced exactly as shown, same icon and text, same proportions. Cyan/white tint on dark background. Do not invent or modify the logo.
```

### Variante light background (navy)
```
LOGO INSTRUCTION: The first attached image is the exact brand logo. Place it small in the bottom-left corner as a watermark — reproduced exactly as shown, same icon and text, same proportions. Dark navy color. Do not invent or modify the logo.
```

## Implementação técnica
```js
// OBRIGATÓRIO: referenceImages → images.edit (não images.generate)
referenceImages: [{ base64: logoBase64, mimeType: 'image/png' }]
```

## Taxa de fidelidade observada
| Estilo | Fidelidade do logo |
|--------|-------------------|
| light-studio | ~70% — ícone correto, texto às vezes errado |
| dark-studio | ~65% — tint certo, mas proporções variáveis |
| cinematic | ~50% — logo às vezes ausente ou incorreto |

## Próximos testes
- [ ] Testar instrução com descrição explícita da posição em px: `bottom-left, 5% from edge`
- [ ] Testar logo como PRIMEIRO elemento descrito antes do sujeito
- [ ] Testar dois passes: geração sem logo → edit com logo como overlay
