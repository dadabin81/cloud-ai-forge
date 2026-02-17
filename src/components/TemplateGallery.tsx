import { useState } from 'react';
import { TEMPLATES, TEMPLATE_CATEGORIES, type ProjectTemplate, type TemplateCategory } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { LayoutGrid, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateGalleryProps {
  onSelectTemplate: (template: ProjectTemplate) => void;
  onCustomizeWithAI: (template: ProjectTemplate) => void;
}

export function TemplateGallery({ onSelectTemplate, onCustomizeWithAI }: TemplateGalleryProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TemplateCategory | 'all'>('all');
  const [preview, setPreview] = useState<ProjectTemplate | null>(null);

  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <LayoutGrid className="w-3.5 h-3.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" /> Template Gallery
          </DialogTitle>
          <DialogDescription>Choose a template to start your project</DialogDescription>
        </DialogHeader>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap pb-2 border-b border-border/50">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm" className="h-7 text-xs"
            onClick={() => setFilter('all')}
          >All</Button>
          {TEMPLATE_CATEGORIES.map(cat => (
            <Button
              key={cat.id}
              variant={filter === cat.id ? 'default' : 'ghost'}
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => setFilter(cat.id)}
            >
              <span>{cat.icon}</span> {cat.label}
            </Button>
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto">
          {preview ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)} className="gap-1 text-xs">
                <X className="w-3 h-3" /> Back to gallery
              </Button>
              <div className="border border-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className="text-2xl">{preview.icon}</span> {preview.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{preview.description}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mb-4">
                  {preview.stack.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Files included:</p>
                  <div className="flex gap-2">
                    {Object.keys(preview.files).map(f => (
                      <Badge key={f} variant="outline" className="text-[10px] font-mono">{f}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { onSelectTemplate(preview); setOpen(false); setPreview(null); }} className="gap-1.5">
                    <LayoutGrid className="w-4 h-4" /> Use Template
                  </Button>
                  <Button variant="outline" onClick={() => { onCustomizeWithAI(preview); setOpen(false); setPreview(null); }} className="gap-1.5">
                    <Sparkles className="w-4 h-4" /> Customize with AI
                  </Button>
                </div>
              </div>
              {/* Quick preview of main file */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
                  Preview: app.jsx
                </div>
                <pre className="p-3 text-xs overflow-auto max-h-[200px] text-muted-foreground">
                  {preview.files['app.jsx']?.code.slice(0, 600)}...
                </pre>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-2">
              {filtered.map(t => (
                <div
                  key={t.id}
                  className="border border-border/50 rounded-xl p-4 hover:border-primary/50 hover:bg-secondary/20 transition-all cursor-pointer group"
                  onClick={() => setPreview(t)}
                >
                  <span className="text-3xl block mb-3">{t.icon}</span>
                  <h3 className="font-medium text-sm group-hover:text-primary transition">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {t.stack.slice(0, 2).map(s => (
                      <Badge key={s} variant="secondary" className="text-[9px] px-1.5 py-0">{s}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
