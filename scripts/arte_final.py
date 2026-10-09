"""
Pipeline de arte final: PDF Figma -> PDF/X-1a CMYK escala 1:1 max resolucao
Uso: python arte_final.py <pasta_entrada> <pasta_saida>

Dependencias:
  pip install pikepdf
  Ghostscript instalado (gswin64c no PATH)
  Perfil ICC CMYK em C:\Windows\System32\spool\drivers\color\
"""

import sys
import subprocess
from pathlib import Path

import pikepdf

PERFIL_ICC = r"C:\Windows\System32\spool\drivers\color\USWebCoatedSWOP.icc"
GHOSTSCRIPT = "gswin64c"
SANGRIA_MM = 5
MM_TO_PT = 2.8346456693


def converter_para_cmyk(entrada: Path, saida: Path) -> bool:
    pdfx_def = saida.parent / "_pdfx_def.ps"
    pdfx_def.write_text(
        f"""%!
[ /Title ({entrada.stem})
  /Creator (Visant Labs Pipeline)
  /DOCINFO pdfmark

[ /_objdef {{OutputIntent}} /type /dict /OBJ pdfmark
[ {{OutputIntent}}
    /Type /OutputIntent
    /S /GTS_PDFX
    /OutputCondition (CMYK Web Coated SWOP)
    /OutputConditionIdentifier (CGATS TR 001)
    /Info (US Web Coated SWOP v2)
    /RegistryName (http://www.color.org)
  >> /PUT pdfmark
[ {{Catalog}} <</OutputIntents [ {{OutputIntent}} ]>> /PUT pdfmark
""",
        encoding="ascii",
    )

    cmd = [
        GHOSTSCRIPT,
        "-dBATCH",
        "-dNOPAUSE",
        "-dQUIET",
        "-dPDFX",
        "-dCompatibilityLevel=1.3",
        "-sDEVICE=pdfwrite",
        "-sColorConversionStrategy=CMYK",
        "-sColorConversionStrategyForImages=CMYK",
        "-sProcessColorModel=DeviceCMYK",
        "-dOverrideICC=true",
        f"-sOutputICCProfile={PERFIL_ICC}",
        "-dPDFSETTINGS=/prepress",
        "-dEmbedAllFonts=true",
        "-dSubsetFonts=false",
        "-dCompressFonts=true",
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dAutoFilterColorImages=false",
        "-dAutoFilterGrayImages=false",
        "-dColorImageFilter=/FlateEncode",
        "-dGrayImageFilter=/FlateEncode",
        f"-sOutputFile={saida}",
        str(pdfx_def),
        str(entrada),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        pdfx_def.unlink(missing_ok=True)
        if result.returncode != 0:
            print(f"  Ghostscript erro: {result.stderr[:200]}")
            return False
        return True
    except Exception as e:
        print(f"  Erro: {e}")
        return False


def adicionar_caixas_pdf(arquivo: Path) -> bool:
    sangria_pt = SANGRIA_MM * MM_TO_PT
    try:
        with pikepdf.open(arquivo, allow_overwriting_input=True) as pdf:
            for page in pdf.pages:
                media = page.MediaBox
                largura_total = float(media[2]) - float(media[0])
                altura_total = float(media[3]) - float(media[1])
                trim = [
                    sangria_pt,
                    sangria_pt,
                    largura_total - sangria_pt,
                    altura_total - sangria_pt,
                ]
                page.TrimBox = trim
                page.BleedBox = media
            pdf.save(arquivo)
        return True
    except Exception as e:
        print(f"  Erro pikepdf: {e}")
        return False


def processar_pasta(pasta_entrada: Path, pasta_saida: Path):
    pasta_saida.mkdir(parents=True, exist_ok=True)
    pdfs = list(pasta_entrada.glob("*.pdf"))
    if not pdfs:
        print(f"Nenhum PDF encontrado em {pasta_entrada}")
        return

    print(f"Processando {len(pdfs)} arquivo(s)...\n")
    sucesso = 0
    falha = 0

    for pdf in pdfs:
        print(f"-> {pdf.name}")
        saida = pasta_saida / pdf.name

        if not converter_para_cmyk(pdf, saida):
            print(f"  X Falhou na conversao CMYK\n")
            falha += 1
            continue

        if not adicionar_caixas_pdf(saida):
            print(f"  X Falhou ao definir caixas\n")
            falha += 1
            continue

        tamanho_mb = saida.stat().st_size / (1024 * 1024)
        print(f"  OK ({tamanho_mb:.1f}MB)\n")
        sucesso += 1

    print(f"\n{'=' * 40}")
    print(f"Concluido: {sucesso} OK, {falha} falha(s)")
    print(f"Saida: {pasta_saida.absolute()}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python arte_final.py <pasta_entrada> <pasta_saida>")
        sys.exit(1)
    processar_pasta(Path(sys.argv[1]), Path(sys.argv[2]))
