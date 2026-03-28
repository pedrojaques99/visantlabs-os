/**
 * Image to Prompt Generator
 *
 * Upload a screenshot → Get a Figma plugin prompt
 * With feedback loop for continuous improvement
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Copy, Check, ThumbsUp, ThumbsDown, Loader2, Image as ImageIcon } from 'lucide-react';

interface GenerationResult {
  prompt: string;
  feedbackId: string;
  componentType: string;
}

export function ImageToPrompt() {
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<'positive' | 'negative' | null>(null);
  const [hint, setHint] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setImage(base64);
      setImagePreview(event.target?.result as string);
      setResult(null);
      setFeedbackSent(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            setImage(base64);
            setImagePreview(event.target?.result as string);
            setResult(null);
            setFeedbackSent(null);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const generatePrompt = async () => {
    if (!image) return;

    setLoading(true);
    try {
      const response = await fetch('/api/plugin/image-to-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { base64: image, mimeType: 'image/png' },
          hint: hint || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setResult({
          prompt: data.prompt,
          feedbackId: data.feedbackId,
          componentType: data.componentType
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      alert('Erro ao gerar prompt: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = () => {
    if (result?.prompt) {
      navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendFeedback = async (success: boolean) => {
    if (!result) return;

    const improvement = window.prompt(
      success
        ? 'O que funcionou bem? (opcional - ajuda a melhorar)'
        : 'O que deu errado? (ex: barras empilhadas, cores erradas, faltou X)'
    );

    try {
      await fetch('/api/plugin/image-to-prompt/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: result.feedbackId,
          success,
          componentType: result.componentType,
          improvement: improvement || undefined,
          generatedPrompt: result.prompt // Include prompt for context
        })
      });
      setFeedbackSent(success ? 'positive' : 'negative');
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Image to Prompt
        </CardTitle>
        <CardDescription>
          Cole ou faça upload de uma screenshot para gerar um prompt para o Figma plugin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg"
            />
          ) : (
            <div className="py-8">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique para upload ou <kbd className="px-1 bg-muted rounded">Ctrl+V</kbd> para colar
              </p>
            </div>
          )}
        </div>

        {/* Hint Input */}
        <input
          type="text"
          placeholder="Dica: tipo de componente (chart, card, form, navigation...)"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />

        {/* Generate Button */}
        <Button
          onClick={generatePrompt}
          disabled={!image || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            'Gerar Prompt'
          )}
        </Button>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Prompt gerado ({result.componentType})
              </span>
              <Button variant="ghost" size="sm" onClick={copyPrompt}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Textarea
              value={result.prompt}
              readOnly
              className="min-h-[200px] font-mono text-xs"
            />

            {/* Feedback */}
            <div className="flex items-center gap-2 justify-end">
              <span className="text-sm text-muted-foreground">Funcionou?</span>
              <Button
                variant={feedbackSent === 'positive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => sendFeedback(true)}
                disabled={feedbackSent !== null}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant={feedbackSent === 'negative' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => sendFeedback(false)}
                disabled={feedbackSent !== null}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ImageToPrompt;
