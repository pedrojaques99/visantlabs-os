import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormLabel as Label } from '@/components/ui/form-label';
import { AdminImageUploader } from './ui/AdminImageUploader';
import { Select } from '@/components/ui/select';
import { appsService, AppConfig } from '@/services/appsService';
import { toast } from 'sonner';

interface AppEditDialogProps {
  app?: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const BADGE_VARIANTS = [
  { value: 'free', label: 'FREE' },
  { value: 'premium', label: 'PREMIUM' },
  { value: 'featured', label: 'FEATURED' },
  { value: 'comingSoon', label: 'COMING SOON' },
];

const CATEGORIES = [
  { value: 'design', label: 'DESIGN' },
  { value: 'mockup', label: 'MOCKUP' },
  { value: 'effects', label: 'EFFECTS' },
  { value: 'audio', label: 'AUDIO' },
  { value: 'experimental', label: 'EXPERIMENTAL' },
];

export const AppEditDialog: React.FC<AppEditDialogProps> = ({ app, isOpen, onClose, onSaved }) => {
  const [formData, setFormData] = useState<Partial<AppConfig>>({
    name: '',
    description: '',
    link: '',
    thumbnail: '',
    badge: '',
    badgeVariant: 'free',
    category: 'design',
    isExternal: false,
    free: true,
    span: 'lg:col-span-1',
    databaseInfo: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (app) {
      setFormData({
        appId: app.appId,
        name: app.name,
        description: app.description,
        link: app.link,
        thumbnail: app.thumbnail,
        badge: app.badge,
        badgeVariant: app.badgeVariant,
        category: app.category,
        isExternal: app.isExternal,
        free: app.free,
        span: app.span,
        databaseInfo: app.databaseInfo || '',
      });
    } else {
      setFormData({
        appId: '',
        name: '',
        description: '',
        link: '',
        thumbnail: '',
        badge: '',
        badgeVariant: 'free',
        category: 'design',
        isExternal: false,
        free: true,
        span: 'lg:col-span-1',
        databaseInfo: '',
      });
    }
  }, [app, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (app?.id) {
        await appsService.update(app.id, formData);
        toast.success('App updated successfully');
      } else {
        await appsService.create(formData);
        toast.success('App created successfully');
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving app:', error);
      toast.error('Failed to save app');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-[#0A0A0A] border-white/10 text-neutral-200 backdrop-blur-xl max-h-[90vh]">
        <DialogHeader className="px-10 pt-10">
          <DialogTitle className="text-3xl font-black font-redhatmono tracking-tighter text-white">
            {app ? 'EDIT APP CONFIG //' : 'NEW APP CONFIG //'}
          </DialogTitle>
          <DialogDescription className="text-neutral-500 font-mono text-xs uppercase tracking-widest">
            Configure application metadata and database identity
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid grid-cols-2 gap-10 py-8 px-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 h-10"
                placeholder="e.g. Mockup Machine"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                value={formData.appId || ''}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 h-10"
                placeholder="e.g. mockup-machine"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Route / Link</Label>
              <Input
                id="link"
                value={formData.link || ''}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 h-10"
                placeholder="e.g. /mockup-machine"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                options={CATEGORIES}
                value={formData.category || 'design'}
                onChange={(v) => setFormData({ ...formData, category: v })}
                className="bg-white/5 border-white/10 h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Badge Variant</Label>
              <Select
                options={BADGE_VARIANTS}
                value={formData.badgeVariant || 'free'}
                onChange={(v) => setFormData({ ...formData, badgeVariant: v as any })}
                className="bg-white/5 border-white/10 h-10"
              />
            </div>

            <div className="space-y-2 text-[10px] font-mono flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                       type="checkbox" 
                       checked={formData.isExternal} 
                       onChange={(e) => setFormData({ ...formData, isExternal: e.target.checked })}
                       className="rounded border-white/10 bg-white/5 text-brand-cyan"
                    />
                    EXTERNAL LINK
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                       type="checkbox" 
                       checked={formData.free} 
                       onChange={(e) => setFormData({ ...formData, free: e.target.checked })}
                       className="rounded border-white/10 bg-white/5 text-brand-cyan"
                    />
                    FREE TOOL
                </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 min-h-[80px]"
                placeholder="Brief description of the app functionality..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="databaseInfo">Database Context</Label>
              <Input
                id="databaseInfo"
                value={formData.databaseInfo || ''}
                onChange={(e) => setFormData({ ...formData, databaseInfo: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 h-10"
                placeholder="e.g. MongoDB: mockups | Prisma: Mockup"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge">Badge Text (Optional)</Label>
              <Input
                id="badge"
                value={formData.badge || ''}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                className="bg-white/5 border-white/10 focus:border-brand-cyan/50 h-10"
                placeholder="e.g. NEW, BETA"
              />
            </div>

            <div className="space-y-2">
              <Label>App Image / Thumbnail</Label>
              {formData.thumbnail && (
                <div className="relative aspect-video rounded-md overflow-hidden border border-white/10 mb-2">
                  <img src={formData.thumbnail} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setFormData({ ...formData, thumbnail: '' })}
                    className="absolute top-1 right-1 bg-black/60 px-2 py-0.5 rounded-full text-red-500 hover:bg-black/80 transition-colors"
                  >
                    <span className="text-[8px] font-bold">REMOVE</span>
                  </button>
                </div>
              )}
              <AdminImageUploader 
                onImageUpload={(img) => setFormData({ ...formData, thumbnail: img.url })}
                compact 
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-white/5 px-10 py-8">
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="text-neutral-500 hover:text-white font-mono text-xs">
            CANCEL
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold px-8 font-mono text-xs"
          >
            {isSaving ? 'SAVING...' : 'SAVE CHANGES //'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
