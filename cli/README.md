# visant

CLI oficial do [Visant Labs](https://visantlabs.com) — conecte qualquer agente AI à inteligência de marca da sua empresa.

```
      _    __ _________ ___    _   __ ______
     | |  / //  _/ ___//   |  / | / //_  __/
     | | / / / / \__ \/ /| | /  |/ /  / /   
     | |/ /_/ / ___/ / ___ |/ /|  /  / /    
     |___//___//____/_/  |_/_/ |_/  /_/     

      visant® // labs // cli // brazil
```

## Instalação

```bash
npm install -g visant
```

## Início rápido

```bash
# 1. Autenticar (abre browser)
visant login

# 2. Conectar ao Claude Code
visant mcp setup

# 3. Reiniciar o Claude Code — 35+ ferramentas disponíveis
```

## Comandos

### `visant login`

Autenticação via browser (OAuth 2.1 + PKCE). Salva credenciais em `~/.visant/credentials.json`.

```bash
visant login           # abre browser
visant login --email   # email/senha (headless, CI/CD)
```

### `visant logout`

Remove as credenciais locais.

### `visant whoami`

Mostra o usuário autenticado e valida o token contra a API.

### `visant mcp setup`

Configura o MCP no Claude Code — escreve `.claude/settings.json` com a conexão ao servidor Visant.

```bash
visant mcp setup   # pergunta: projeto atual ou global
```

Após executar, **reinicie o Claude Code** para ativar as ferramentas.

### `visant mcp status`

Testa a conexão ao servidor MCP e lista as ferramentas disponíveis.

```bash
visant mcp status
# → Conectado — 35 ferramentas disponíveis
#   • document_extract
#   • get_brand_guideline
#   • generate_mockup
#   • create_creative_plan
#   • … +31 mais
```

## Ferramentas MCP disponíveis após setup

| Ferramenta | Descrição |
|---|---|
| `document_extract` | Extrai texto + brand tokens de um PDF (algoritmo + Gemini) |
| `get_brand_guideline` | Dados completos de uma marca (cores, tipografia, voz, estratégia) |
| `list_brand_guidelines` | Lista todas as marcas da conta |
| `generate_mockup` | Geração de imagem com AI (OpenAI / Gemini / Seedream) |
| `batch_generate_mockups` | Até 20 mockups em paralelo |
| `create_creative_plan` | Plano de layout para peça de marketing |
| `generate_persona` | Persona de audiência detalhada |
| `generate_archetype` | Arquétipos de marca |
| `generate_naming` | Sugestões de nome para marca/produto |
| `get_brand_design_system` | Design system pronto para geração de código |
| `create_ad_campaign` | Campanha de anúncios completa com AI |
| + 24 mais | … |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VISANT_API_URL` | `https://api.visantlabs.com/api` | URL da API (override para dev local) |

## Desenvolvimento local

```bash
# Na raiz do repositório visantlabs-os:
npm run cli            # executa o CLI em modo dev
npm run cli:build      # compila para dist/

# Publicar no npm:
cd cli && bash publish.sh
```

## Licença

MIT — [Visant Labs](https://visantlabs.com)
