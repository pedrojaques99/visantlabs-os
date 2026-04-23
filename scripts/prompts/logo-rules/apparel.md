# Logo Rule: Apparel & Product
> Contexto: logo aplicado em roupa, produto, embalagem

## Instrução

```
LOGO INSTRUCTION: The first attached image is the exact brand logo. Reproduce it exactly as shown on the [item] — same icon, same text, same proportions. Apply it naturally as if [printed/embroidered/engraved]. Do not invent or modify the logo.
```

### Por item
| Item | Instrução de aplicação |
|------|----------------------|
| Jersey / camiseta | `as if embroidered on the left chest` |
| Kit bag / mochila | `as if embroidered on the front panel` |
| Caixa / packaging | `as if printed on the face, centered` |
| Garrafa / metal | `as if laser engraved on the front` |
| Tênis | `as if printed on the tongue or heel tab` |

## Taxa de fidelidade observada
Menor que watermark — modelo tende a deformar o logo quando aplicado em superfície 3D.

| Produto | Fidelidade |
|---------|-----------|
| Kit bag (flat surface) | ~65% |
| Jersey (flat lay) | ~70% |
| Garrafa (curva) | ~40% — deforma |
| Packaging (3D) | ~50% |

## Estratégia recomendada para alta fidelidade
1. **Gera o produto sem logo** (`images.generate`) — produto limpo
2. **Edita adicionando o logo** (`images.edit` com logo + produto como inputs)
3. Prompt: `Add the logo from image 1 to the [position] of the product in image 2. Reproduce exactly, same proportions.`

Dois passes = mais controle. Um passe = mais rápido mas menos preciso.

## Próximos testes
- [ ] Implementar pipeline dois passes para produtos
- [ ] Testar `flat lay` (produto em superfície plana) vs `3D mockup` — flat lay tem fidelidade maior
- [ ] Testar logo em versão só símbolo (`Simbolo.png`) vs logo completo — símbolo é mais legível em small
