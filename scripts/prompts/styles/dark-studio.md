# Style: Dark Studio — Motion Ghost
> Resultado: ✅ Funciona bem com atletas esportivos

## Bloco de estilo

```
Photography style: dramatic dark studio background, cinematic cyan and deep blue rim lighting.
Multiple-exposure motion ghost effect — 2 to 3 semi-transparent duplicates trail behind the subject, motion blur on ghost frames.
Primary subject: sharp focus. Ghosts: soft, translucent blue-cyan.
Vertical portrait orientation, full body. Photorealistic, commercial quality.
```

## Parâmetros
- **Modelo:** `gpt-image-2`
- **Size:** `1024x1536` (vertical)
- **designType:** `social-media`
- **Quality tier:** 2 créditos (1K)

## O que funciona
- Contraste alto entre sujeito escuro e fundo escuro → ghosts aparecem bem
- Rim lighting cyan define bem a silhueta
- `2 to 3` ghosts — mais que isso fica poluído

## O que não funciona
- Fundo muito escuro + roupa escura → sujeito some no fundo
- Mais de 3 ghosts → perde leitura

## Combinações testadas
| Sujeito | Resultado |
|---------|-----------|
| Sprinter (navy tank) | ✅ Bom contraste |
| Cricket batsman (white kit) | ✅ Excelente |
| Football striker (navy kit) | ⚠️ Pouco contraste |
| Hockey player (navy kit) | ⚠️ Pouco contraste |
| Rugby (navy jersey) | ✅ Ok |

## Próximos testes
- [ ] Adicionar cor de fundo (deep navy, midnight blue) para melhorar contraste com kit navy
- [ ] Testar `rim lighting magenta` como variação
