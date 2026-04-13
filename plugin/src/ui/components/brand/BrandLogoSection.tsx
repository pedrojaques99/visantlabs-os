import React from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export function BrandLogoSection() {
  const { logos, updateBrandLogo } = usePluginStore();

  const handleLogoUpload = (slot: 'light' | 'dark' | 'accent', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        updateBrandLogo(slot, src);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Brand Logos</h3>
      <div className="grid grid-cols-3 gap-2">
        {logos.map((logo) => (
          <div key={logo.name} className="flex flex-col items-center gap-2">
            <div className="w-full aspect-video bg-muted border border-border rounded flex items-center justify-center overflow-hidden">
              {logo.src ? (
                <img src={logo.src} alt={logo.name} className="max-h-full max-w-full" />
              ) : (
                <Upload size={16} className="text-muted-foreground" />
              )}
            </div>
            <label className="text-xs font-mono capitalize text-muted-foreground">{logo.name}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleLogoUpload(logo.name, e)}
              className="hidden"
              id={`logo-${logo.name}`}
            />
            <label htmlFor={`logo-${logo.name}`} className="cursor-pointer">
              <Button variant="ghost" size="sm" className="text-xs h-6 w-full">
                Upload
              </Button>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
