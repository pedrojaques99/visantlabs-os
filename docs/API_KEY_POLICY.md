# API Key Security Policy

## Overview

This document explains how we handle and secure your Gemini API keys when you choose to use your own API key with our service.

## Security Measures

### Encryption

- **Encryption Algorithm**: We use AES-256-GCM encryption, a military-grade encryption standard
- **Storage**: Your API keys are encrypted before being stored in our database
- **Master Key**: We use a master encryption key stored securely in environment variables (never in code or version control)
- **Encryption Process**: Your API key is encrypted immediately when you save it, using industry-standard cryptographic libraries

### Access Control

- **Authentication Required**: Only authenticated users can save or access their own API keys
- **User Isolation**: Each user can only access their own encrypted API key
- **No Plaintext Storage**: Your API key is never stored in plaintext in our database, logs, or anywhere else
- **No Exposure**: We never return decrypted API keys in API responses - we only confirm successful operations

### Usage

- **Priority**: When you provide your own API key, it takes priority over the system's default API key for your requests
- **Quota**: Your API key uses your own Google Cloud quota and credits
- **Transparency**: All API calls made with your key are billed to your Google Cloud account, not ours

## Your Responsibilities

### Key Management

1. **Keep Your Key Secure**: Never share your API key with others or commit it to version control
2. **Rotate Regularly**: Consider rotating your API key periodically for better security
3. **Monitor Usage**: Monitor your Google Cloud Console for unexpected usage or charges
4. **Key Restrictions**: Configure API key restrictions in Google AI Studio to limit where it can be used

### Best Practices

1. **Restrict Your Key**: In Google AI Studio, set restrictions on your API key:
   - Application restrictions (e.g., IP address restrictions if possible)
   - API restrictions (limit to only Gemini API)
   
2. **Set Usage Quotas**: Configure daily/monthly usage quotas in Google Cloud Console to prevent unexpected charges

3. **Monitor Billing**: Regularly check your Google Cloud billing to ensure usage aligns with expectations

4. **Delete When Not Needed**: If you stop using the service, delete your API key from our system

## How It Works

1. **Saving**: When you save your API key, it's encrypted using AES-256-GCM before being stored
2. **Storage**: Only the encrypted version is stored in our database
3. **Usage**: When making API calls, we decrypt your key in memory, use it for the request, and immediately discard it
4. **Deletion**: When you delete your key, it's permanently removed from our database

## Data Privacy

- We never share your API keys with third parties
- We never use your API keys for any purpose other than processing your requests
- We follow industry best practices for secure key management
- Your encrypted keys are stored in a secure, access-controlled database

## Compliance

- **Encryption Standards**: We follow industry standards (AES-256) for data encryption
- **Access Controls**: We implement proper authentication and authorization controls
- **Audit Trail**: API key operations (save/delete) are logged for security auditing

## Support

If you have concerns about API key security or notice any suspicious activity:

1. Delete your API key from our system immediately
2. Rotate your API key in Google AI Studio
3. Contact our support team

## Additional Resources

- [Google AI Studio API Keys](https://aistudio.google.com/app/apikey)
- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)

---

**Last Updated**: 2025-01-27

**Version**: 1.0











