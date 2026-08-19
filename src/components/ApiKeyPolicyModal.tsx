import React, { useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, Lock, Shield, Key, AlertCircle, ExternalLink } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';

interface ApiKeyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyPolicyModal: React.FC<ApiKeyPolicyModalProps> = ({ isOpen, onClose }) => {
  useScrollLock(isOpen);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] bg-card border border-border rounded-md shadow-2xl p-6 md:p-8 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute top-4 right-4 bg-muted hover:bg-accent p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors z-10"
          title="Close"
        >
          <X size={20} />
        </Button>

        <div className="pr-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-muted-foreground" size={24} />
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
              API Key Security Policy
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-mono mb-8">
            Last Updated: January 27, 2025 • Version: 1.0
          </p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed max-h-[calc(90vh-180px)] overflow-y-auto">
            {/* Overview */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Overview</h2>
              <p className="text-muted-foreground">
                This document explains how we handle and secure your Gemini API keys when you choose
                to use your own API key with our service.
              </p>
            </div>

            {/* Security Measures */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Security Measures</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="text-muted-foreground" size={18} />
                    <h3 className="text-base font-semibold text-foreground">Encryption</h3>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                    <li>
                      <strong className="text-muted-foreground">Encryption Algorithm:</strong> We
                      use AES-256-GCM encryption, a military-grade encryption standard
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Storage:</strong> Your API keys are
                      encrypted before being stored in our database
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Master Key:</strong> We use a master
                      encryption key stored securely in environment variables (never in code or
                      version control)
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Encryption Process:</strong> Your
                      API key is encrypted immediately when you save it, using industry-standard
                      cryptographic libraries
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="text-muted-foreground" size={18} />
                    <h3 className="text-base font-semibold text-foreground">Access Control</h3>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                    <li>
                      <strong className="text-muted-foreground">Authentication Required:</strong>{' '}
                      Only authenticated users can save or access their own API keys
                    </li>
                    <li>
                      <strong className="text-muted-foreground">User Isolation:</strong> Each user
                      can only access their own encrypted API key
                    </li>
                    <li>
                      <strong className="text-muted-foreground">No Plaintext Storage:</strong> Your
                      API key is never stored in plaintext in our database, logs, or anywhere else
                    </li>
                    <li>
                      <strong className="text-muted-foreground">No Exposure:</strong> We never
                      return decrypted API keys in API responses - we only confirm successful
                      operations
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Usage</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                    <li>
                      <strong className="text-muted-foreground">Priority:</strong> When you provide
                      your own API key, it takes priority over the system's default API key for your
                      requests
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Quota:</strong> Your API key uses
                      your own Google Cloud quota and credits
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Transparency:</strong> All API calls
                      made with your key are billed to your Google Cloud account, not ours
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Your Responsibilities */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Your Responsibilities</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Key Management</h3>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-6">
                    <li>
                      <strong className="text-muted-foreground">Keep Your Key Secure:</strong> Never
                      share your API key with others or commit it to version control
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Rotate Regularly:</strong> Consider
                      rotating your API key periodically for better security
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Monitor Usage:</strong> Monitor your
                      Google Cloud Console for unexpected usage or charges
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Key Restrictions:</strong> Configure
                      API key restrictions in Google AI Studio to limit where it can be used
                    </li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Best Practices</h3>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-6">
                    <li>
                      <strong className="text-muted-foreground">Restrict Your Key:</strong> In
                      Google AI Studio, set restrictions on your API key:
                      <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                        <li>
                          Application restrictions (e.g., IP address restrictions if possible)
                        </li>
                        <li>API restrictions (limit to only Gemini API)</li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Set Usage Quotas:</strong> Configure
                      daily/monthly usage quotas in Google Cloud Console to prevent unexpected
                      charges
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Monitor Billing:</strong> Regularly
                      check your Google Cloud billing to ensure usage aligns with expectations
                    </li>
                    <li>
                      <strong className="text-muted-foreground">Delete When Not Needed:</strong> If
                      you stop using the service, delete your API key from our system
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">How It Works</h2>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-6">
                <li>
                  <strong className="text-muted-foreground">Saving:</strong> When you save your API
                  key, it's encrypted using AES-256-GCM before being stored
                </li>
                <li>
                  <strong className="text-muted-foreground">Storage:</strong> Only the encrypted
                  version is stored in our database
                </li>
                <li>
                  <strong className="text-muted-foreground">Usage:</strong> When making API calls,
                  we decrypt your key in memory, use it for the request, and immediately discard it
                </li>
                <li>
                  <strong className="text-muted-foreground">Deletion:</strong> When you delete your
                  key, it's permanently removed from our database
                </li>
              </ol>
            </div>

            {/* Data Privacy */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Data Privacy</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>We never share your API keys with third parties</li>
                <li>
                  We never use your API keys for any purpose other than processing your requests
                </li>
                <li>We follow industry best practices for secure key management</li>
                <li>Your encrypted keys are stored in a secure, access-controlled database</li>
              </ul>
            </div>

            {/* Compliance */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Compliance</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>
                  <strong className="text-muted-foreground">Encryption Standards:</strong> We follow
                  industry standards (AES-256) for data encryption
                </li>
                <li>
                  <strong className="text-muted-foreground">Access Controls:</strong> We implement
                  proper authentication and authorization controls
                </li>
                <li>
                  <strong className="text-muted-foreground">Audit Trail:</strong> API key operations
                  (save/delete) are logged for security auditing
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-warning" size={18} />
                <h2 className="text-lg font-semibold text-foreground">Support</h2>
              </div>
              <p className="text-muted-foreground mb-2">
                If you have concerns about API key security or notice any suspicious activity:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-6">
                <li>Delete your API key from our system immediately</li>
                <li>Rotate your API key in Google AI Studio</li>
                <li>Contact our support team</li>
              </ol>
            </div>

            {/* Additional Resources */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Additional Resources</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-6">
                <li>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-brand-cyan/80 underline flex items-center gap-1"
                  >
                    Google AI Studio API Keys
                    <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://cloud.google.com/docs/authentication/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-brand-cyan/80 underline flex items-center gap-1"
                  >
                    Google Cloud API Key Best Practices
                    <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://cloud.google.com/security/best-practices"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-brand-cyan/80 underline flex items-center gap-1"
                  >
                    Google Cloud Security Best Practices
                    <ExternalLink size={14} />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
