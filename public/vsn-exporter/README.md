# VSN Exporter

Ferramenta de linha de comando (TUI) para **organizar pastas de design e processar PDFs/imagens** em lote: separar transparentes, extrair avatares, unificar/decompor PDFs, rasterizar, vetorizar (AI/EPS→SVG), converter para JPG/WebP, OCR, comprimir e empacotar entregas.

Roda no **Windows + PowerShell**. Menu navegável por setas — sem decorar comandos.

---

## 1. Requisitos

| Item | Obrigatório | Para quê |
|------|-------------|----------|
| **Windows 10/11** | ✅ | Sistema |
| **PowerShell 5.1+** (já vem no Windows) | ✅ | Roda o script |
| ImageMagick (`magick`) | opcional | Imagens, WebP, PDF→PNG |
| Ghostscript (`gswin64c`) | opcional | Comprimir / rasterizar / CMYK |
| qpdf | opcional | Merge / split / páginas de PDF |
| Inkscape | opcional | AI/EPS→SVG e raster de alta fidelidade |
| ocrmypdf + Tesseract | opcional | OCR (PDF pesquisável) |
| Python 3 | opcional | Arte final CMYK (PDF/X-1a) |

> As ferramentas externas são **opcionais**: cada função só pede a sua. Se faltar algo, o menu avisa exatamente o que instalar e segue funcionando no resto.

### Instalar tudo de uma vez (winget)

```powershell
winget install ImageMagick.ImageMagick
winget install ArtifexSoftware.GhostScript
winget install qpdf.qpdf
winget install Inkscape.Inkscape
winget install UB-Mannheim.TesseractOCR
pip install ocrmypdf PyMuPDF
```

O exporter encontra essas ferramentas sozinho (PATH ou caminhos padrão do winget) — não precisa configurar nada.

---

## 2. Baixar

**Importante:** baixe a **pasta inteira**, não só o `vsn-exporter.ps1`. O script carrega os módulos de `lib/` ao lado dele — um arquivo solto não funciona.

- **Via Git:** `git clone` do repo e use `public/vsn-exporter/`, ou
- **Via web:** baixe `vsn-exporter.ps1` **+** a pasta `lib/` mantendo a estrutura:

```
vsn-exporter/
├─ vsn-exporter.ps1
├─ vsn-context-menu.reg   (opcional, integração com botão direito)
└─ lib/
   ├─ log.ps1  tools.ps1  organize.ps1
   ├─ image.ps1  pdf.ps1  delivery.ps1
```

---

## 3. Rodar

Abra o PowerShell na pasta que você quer processar (ou passe o caminho) e execute:

```powershell
# processa a pasta atual
powershell -ExecutionPolicy Bypass -File "C:\caminho\vsn-exporter\vsn-exporter.ps1"

# processa uma pasta específica
powershell -ExecutionPolicy Bypass -File "C:\caminho\vsn-exporter\vsn-exporter.ps1" -Path "D:\Cliente\Entrega"
```

> `-ExecutionPolicy Bypass` é necessário porque scripts baixados ficam bloqueados por padrão. Não altera a política do sistema — só dessa execução.

### Navegação no menu
- **↑ / ↓** — navegar · **Enter** — abrir/executar · **Esc** — voltar/sair
- **1–9** — atalho direto para o item
- O menu é em dois níveis: **grupo** (Organização, PDF & Vetor, Imagem, Entrega, Sistema) → **ação**.

---

## 4. Modo automático (sem menu)

Para scripts/automação, use as flags e ele executa direto e sai:

```powershell
# simular sem alterar nada (recomendado na 1ª vez)
... vsn-exporter.ps1 -Path "D:\Pasta" -DryRun

-Merge        # unifica PDFs
-Split        # decompõe páginas de PDF
-Rasterize    # PDF → PNG
-Convert      # AI/EPS → SVG
-ToFigma      # prepara raster + SVG p/ Figma
-ToJPG        # PNG → JPG    (-JPGQuality 90)
```

Exemplo: `... vsn-exporter.ps1 -Path "D:\Entrega" -Merge`

---

## 5. O que cada grupo faz

- **Organização** — avatares/ícones, extrair transparentes, separar por extensão, agrupar vetores, “Organizar Tudo”.
- **PDF & Vetor** — merge, split, PDF↔PNG, vetorizar, reordenar/substituir/extrair páginas, OCR (com estimativa de custo LLM), metadados, comprimir, arte final CMYK, extrair imagens.
- **Imagem & JPG** — PNG→JPG, WebP, limpar EXIF, mudar qualidade.
- **Entrega** — gerar INDEX/README, empacotar `.zip`.
- **Sistema** — gerar `.ico`, abrir log, trocar caminho, sair.

---

## 6. Dicas e segurança

- **Sempre teste com `-DryRun`** numa pasta nova — ele mostra o que faria sem mexer nos arquivos.
- Logs de sessão e crashes ficam em `%TEMP%` (`vsn-exporter-crash.log`); o menu **“Abrir Log”** abre o último.
- As funções operam **na pasta-alvo** — aponte para uma cópia se quiser preservar os originais.

### Integração com botão direito (opcional, Windows)

`vsn-context-menu.reg` adiciona “VSN Exporter” ao menu de contexto de pastas. Os caminhos dentro do `.reg` são **placeholders** (`C:\PATH\TO\vsn-exporter\…`) — troque pelo seu caminho real (e o ícone) antes de aplicar com duplo-clique. Dica: salve sua cópia editada como `vsn-context-menu.local.reg` (esse padrão é ignorado pelo git, então não vai parar no repo).

---

## Estrutura interna

| Arquivo | Responsável por |
|---------|-----------------|
| `vsn-exporter.ps1` | TUI, menu, roteamento, tratamento de erro |
| `lib/tools.ps1` | localizar ferramentas externas (magick, gs, qpdf, inkscape) |
| `lib/log.ps1` | logging de sessão |
| `lib/organize.ps1` | organização de pastas/arquivos |
| `lib/pdf.ps1` | todas as operações de PDF + OCR + metadados |
| `lib/image.ps1` | JPG, WebP, EXIF, ICO |
| `lib/delivery.ps1` | INDEX e empacotamento |
