export const MCP_SPEC_VERSION = '2025-11-25';
export const MCP_BETA_HEADER = 'mcp-client-2025-11-20';

export const API_BASE_URL = process.env.API_BASE_URL || 'https://api.visantlabs.com';
export const FRONTEND_BASE_URL =
  process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'https://visantlabs.com';
export const MCP_ENDPOINT = `${API_BASE_URL}/api/mcp`;

export const MCP_SCOPES = ['read', 'write', 'generate'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_RESULT_MAX_CHARS = 140_000;

export const SUPPORT_EMAIL = 'contato@visant.co';

export const PLATFORM_DESCRIPTION =
  'AI design platform that turns brand guidelines into production-ready mockups, creatives, and brand identities — accessible via MCP, REST API, or web UI.';

// ── Agent-facing protocol hints (SSoT — used by llms.txt, platform-mcp, well-known, 401) ──

export const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
export const OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

export const MCP_HINTS = {
  jsonRpcSteps: (endpoint: string, version: string) => [
    `1. Initialize: POST ${endpoint} with {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"${version}","capabilities":{},"clientInfo":{"name":"YourAgent","version":"1.0"}},"id":1} → save the mcp-session-id response header`,
    `2. List tools: POST ${endpoint} with {"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}`,
    `3. Call a tool: POST ${endpoint} with {"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool-name","arguments":{}},"id":3}`,
  ],

  requiredHeaders: [
    'Authorization: Bearer <access_token>',
    'Content-Type: application/json',
    'Mcp-Session-Id: <id from initialize> (include in all requests after step 1)',
    'Accept: application/json (recommended — returns plain JSON instead of SSE streams)',
  ],

  warnings: {
    argumentsRequired:
      '"arguments": {} is REQUIRED in every tools/call, even for parameterless tools. Omitting it causes a validation error.',
    notRestApi:
      'This is NOT a REST API. Do NOT call paths like GET /auth/profile. Use tools/call with the tool name.',
    persistToken:
      'Persist the access token (1h lifetime) and reuse it across requests. Use the refresh token when it expires. Do NOT re-authenticate for every call.',
    verificationUri:
      'Show user ONLY the verification_uri_complete link — the code is already embedded in the URL. Do NOT show the code separately.',
  },

  responseFormat:
    'By default, responses are SSE (Server-Sent Events). If your client cannot parse SSE, add Accept: application/json header to get plain JSON responses.',

  oauthSteps: (baseUrl: string) => [
    `1. Register: POST ${baseUrl}/oauth/register with {"client_name":"YourAgent","redirect_uris":["http://localhost:3456/callback"],"grant_types":["authorization_code"]}`,
    '2. PKCE: generate code_verifier (random 43+ chars) → code_challenge = base64url(sha256(verifier))',
    `3. Authorize: open ${baseUrl}/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=<random>&response_type=code&scope=read+write+generate in user's browser`,
    `4. Exchange: POST ${baseUrl}/oauth/token with grant_type=authorization_code&code=...&code_verifier=...&client_id=...`,
    `5. Refresh: POST ${baseUrl}/oauth/token with grant_type=refresh_token&refresh_token=...`,
  ],

  deviceFlowSteps: (baseUrl: string) => [
    `1. POST ${baseUrl}/oauth/device/code with {"client_id":"...","scope":"read write generate"}`,
    '2. Show user ONLY the verification_uri_complete link (code is already in the URL — do NOT show code separately)',
    `3. Poll POST ${baseUrl}/oauth/token with grant_type=${DEVICE_CODE_GRANT}&device_code=...&client_id=... every 5s`,
    '4. When user approves, poll returns access_token + refresh_token automatically',
  ],

  protocolHintCompact: (endpoint: string, version: string) =>
    `MCP uses JSON-RPC 2.0. POST to ${endpoint}: ` +
    `(1) {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"${version}","capabilities":{},"clientInfo":{"name":"...","version":"1.0"}},"id":1} → save mcp-session-id header, ` +
    `(2) {"method":"tools/list","params":{},"id":2}, ` +
    `(3) {"method":"tools/call","params":{"name":"tool-name","arguments":{}},"id":3}. ` +
    `IMPORTANT: "arguments":{} is required even for parameterless tools. ` +
    `Headers: Authorization: Bearer <token>, Content-Type: application/json, Mcp-Session-Id: <id>. ` +
    `Add Accept: application/json for plain JSON responses instead of SSE streams.`,

  unauthorizedMessage: (baseUrl: string, fullGuideUrl: string) =>
    `Unauthorized — you need an access token. ` +
    `Options: (1) OAuth 2.1 + PKCE: GET ${baseUrl}/.well-known/oauth-authorization-server, ` +
    `(2) Device Flow (Telegram/CLI/remote agents): POST ${baseUrl}/oauth/device/code, ` +
    `(3) API key: Authorization: Bearer visant_sk_xxx. ` +
    `After authenticating, use JSON-RPC to this endpoint: {"jsonrpc":"2.0","method":"initialize",...} then tools/list, then tools/call. ` +
    `Full guide: ${fullGuideUrl}`,
} as const;
