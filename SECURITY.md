# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `dev` branch | Yes |
| Latest `main` branch | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public issue.**

Instead, email **security@visant.co** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Security Measures

This project implements:

- **Authentication**: Google OAuth, email/password with TOTP 2FA
- **Rate limiting**: Multi-layer (global, auth, password reset, API)
- **CSP headers**: Content Security Policy via Helmet.js
- **Input validation**: hCaptcha on signup, sanitized AI prompts
- **API key security**: SHA-256 hashed storage, prefix-only display
- **PII redaction**: Sensitive data stripped from logs
- **Dependency scanning**: GitHub Dependabot enabled

## Environment Variables

Never commit `.env` or `.env.local` files. Use `env.example` as a template and configure secrets through your hosting provider's environment management (Vercel, Coolify, etc.).
