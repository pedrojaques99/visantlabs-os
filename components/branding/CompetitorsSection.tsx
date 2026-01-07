import React, { useState, useEffect } from 'react';
import { Plus, X, ExternalLink } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

interface Competitor {
  name: string;
  url?: string;
}

interface CompetitorsSectionProps {
  competitors: string[] | Array<{ name: string; url?: string }>;
  isEditing?: boolean;
  onContentChange?: (value: string[] | Array<{ name: string; url?: string }>) => void;
}

// Helper to normalize competitors to array of objects
const normalizeCompetitors = (competitors: string[] | Array<{ name: string; url?: string }>): Competitor[] => {
  if (!competitors || competitors.length === 0) return [];

  return competitors.map(item => {
    if (typeof item === 'string') {
      return { name: item, url: '' };
    }
    return { name: item.name || '', url: item.url || '' };
  });
};

// Helper to convert back to the format stored in database
const denormalizeCompetitors = (competitors: Competitor[], preserveFormat: boolean): string[] | Array<{ name: string; url?: string }> => {
  if (!preserveFormat) {
    // If all have URLs, return objects; otherwise return strings
    const hasUrls = competitors.some(c => c.url && c.url.trim());
    if (hasUrls) {
      return competitors.map(c => ({ name: c.name, url: c.url || '' }));
    }
    return competitors.map(c => c.name);
  }

  // Check if original format had objects - return all objects if any has URL, otherwise all strings
  const hasUrls = competitors.some(c => c.url && c.url.trim());
  if (hasUrls) {
    return competitors.map(c => ({ name: c.name, url: c.url || '' }));
  }
  return competitors.map(c => c.name);
};

export const CompetitorsSection: React.FC<CompetitorsSectionProps> = ({
  competitors,
  isEditing = false,
  onContentChange,
}) => {
  const { theme } = useTheme();
  const [localCompetitors, setLocalCompetitors] = useState<Competitor[]>(normalizeCompetitors(competitors));

  useEffect(() => {
    setLocalCompetitors(normalizeCompetitors(competitors));
  }, [competitors]);

  const handleNameChange = (index: number, value: string) => {
    const newCompetitors = [...localCompetitors];
    newCompetitors[index] = { ...newCompetitors[index], name: value };
    setLocalCompetitors(newCompetitors);
    if (onContentChange) {
      const hasUrls = newCompetitors.some(c => c.url && c.url.trim());
      onContentChange(denormalizeCompetitors(newCompetitors, hasUrls));
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newCompetitors = [...localCompetitors];
    newCompetitors[index] = { ...newCompetitors[index], url: value };
    setLocalCompetitors(newCompetitors);
    if (onContentChange) {
      const hasUrls = newCompetitors.some(c => c.url && c.url.trim());
      onContentChange(denormalizeCompetitors(newCompetitors, hasUrls));
    }
  };

  const handleAddCompetitor = () => {
    const newCompetitors = [...localCompetitors, { name: '', url: '' }];
    setLocalCompetitors(newCompetitors);
    if (onContentChange) {
      onContentChange(denormalizeCompetitors(newCompetitors, false));
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    const newCompetitors = localCompetitors.filter((_, i) => i !== index);
    setLocalCompetitors(newCompetitors);
    if (onContentChange) {
      const hasUrls = newCompetitors.some(c => c.url && c.url.trim());
      onContentChange(denormalizeCompetitors(newCompetitors, hasUrls));
    }
  };

  const formatUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  if (isEditing && onContentChange) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localCompetitors.map((competitor, index) => (
            <div
              key={index}
              className={`border rounded-xl p-4 hover:border-[#brand-cyan]/50 transition-colors relative ${theme === 'dark'
                  ? 'bg-black/40 border-zinc-800/60'
                  : 'bg-zinc-100 border-zinc-300'
                }`}
            >
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                    Nome
                  </label>
                  <Input
                    value={competitor.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    placeholder="Nome do concorrente"
                    className={`bg-transparent font-manrope text-sm border ${theme === 'dark'
                        ? 'border-zinc-700/50 text-zinc-300'
                        : 'border-zinc-400/50 text-zinc-800'
                      }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                    Link (opcional)
                  </label>
                  <Input
                    value={competitor.url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://exemplo.com"
                    className={`bg-transparent font-manrope text-sm border ${theme === 'dark'
                        ? 'border-zinc-700/50 text-zinc-300'
                        : 'border-zinc-400/50 text-zinc-800'
                      }`}
                  />
                </div>
              </div>
              <button
                onClick={() => handleRemoveCompetitor(index)}
                className={`absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                title="Remover concorrente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddCompetitor}
          className={`flex items-center gap-2 px-4 py-2 border hover:border-[#brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono transition-all duration-300 ${theme === 'dark'
              ? 'bg-black/40 border-zinc-800/60 text-zinc-300'
              : 'bg-zinc-100 border-zinc-300 text-zinc-800'
            }`}
        >
          <Plus className="h-4 w-4" />
          Adicionar concorrente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {localCompetitors.map((competitor, index) => (
        <div
          key={index}
          className={`border rounded-xl p-4 transition-colors group overflow-hidden ${theme === 'dark'
              ? 'bg-black/40 border-zinc-800/60 hover:border-zinc-700/60'
              : 'bg-zinc-100 border-zinc-300 hover:border-zinc-400'
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
                }`}>
                {competitor.name}
              </p>
              {competitor.url && competitor.url.trim() && (
                <a
                  href={formatUrl(competitor.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1 mt-2 w-full min-w-0 text-xs font-mono transition-colors ${theme === 'dark'
                      ? 'text-brand-cyan hover:text-brand-cyan/80'
                      : 'text-blue-600 hover:text-blue-700'
                    }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate min-w-0">
                    {competitor.url.replace(/^https?:\/\//, '')}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

