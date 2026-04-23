# Style: Cinematic Lifestyle
> Resultado: ✅ Funciona para contextos autênticos, logo ainda inconsistente

## Bloco de estilo

```
Cinematic lifestyle photography. Natural dramatic lighting — golden hour or overcast diffused light.
Film grain texture, shallow depth of field, color grading with slight teal-and-orange or cool blue tones.
Real person in authentic environment, candid or editorial feel. No studio background.
High-end advertising photography quality. 35mm or 50mm lens feel.
```

## Parâmetros
- **Modelo:** `gpt-image-2`
- **Size:** `1024x1536` (vertical) ou `1024x1024` (close-ups)
- **designType:** `social-media`
- **Quality tier:** 2 créditos (1K)

## O que funciona
- `golden hour` → iluminação quente e cinematográfica consistente
- `film grain texture` → eleva percepção de qualidade editorial
- `candid or editorial feel` → evita poses engessadas
- `35mm or 50mm lens feel` → perspectiva natural, não distorcida

## O que não funciona
- Logo em apparel ainda inconsistente — modelo tende a ignorar
- `No studio background` às vezes ainda gera fundo genérico
- Ambientes muito específicos (nomes de lugares) → modelo inventa

## Logo em lifestyle
O maior desafio deste estilo. Logo em roupas/produtos requer:
1. `LOGO INSTRUCTION` explícito (ver `logo-rules/apparel.md`)
2. Logo como referenceImage no `images.edit`
3. Mesmo assim: ~60% de fidelidade — modelo ainda interpreta livremente

## Próximos testes
- [ ] Testar `overcast diffused light` sozinho vs `golden hour` — qual é mais consistente
- [ ] Adicionar descrição de ambiente mais específica (parque, quadra, academia)
- [ ] Testar dois passes: gera foto sem logo → edita adicionando logo
