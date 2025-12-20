# Setting Up LLM/AI Services

This guide explains how to configure AI services for the VSN Mockup Machine.

## Google Gemini (Recommended)

The application uses Google Gemini for AI-powered features like mockup generation and branding analysis.

### Getting Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### Configuration

Add the following to your `.env.local` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Features Enabled

With Gemini configured, you'll have access to:

- **AI Mockup Generation**: Generate product mockups from text prompts
- **Branding Analysis**: AI-powered brand identity creation
- **Smart Suggestions**: Context-aware design recommendations

### Rate Limits

Google Gemini has rate limits that vary by plan:

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Free | 15 | 1,500 |
| Pay-as-you-go | Higher limits | Based on usage |

### User API Keys

The application supports users providing their own Gemini API keys. This is useful for:

- Bypassing platform rate limits
- Using their own quota
- Enterprise deployments

To enable this feature, set:

```env
API_KEY_ENCRYPTION_KEY=your_32_byte_hex_encryption_key_here
```

Generate a secure key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Troubleshooting

**Error: "API key not valid"**
- Verify the key is correct and hasn't been revoked
- Check if the key has the necessary permissions

**Error: "Quota exceeded"**
- You've hit the rate limit; wait a few minutes
- Consider upgrading to a paid plan

**AI features disabled**
- Ensure `GEMINI_API_KEY` is set in your environment
- Restart the server after adding the key

