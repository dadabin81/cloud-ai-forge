import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Wand2, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WireframePreview } from '@/components/WireframePreview';
import { TEMPLATES, type ProjectTemplate } from '@/lib/templates';

export interface DesignOptions {
  colorScheme: 'dark' | 'light' | 'custom';
  typography: 'sans' | 'serif' | 'mono';
  layout: 'topnav' | 'sidebar' | 'fullwidth';
  style: 'minimal' | 'corporate' | 'playful';
  sections: string[];
  templateId?: string;
}

const AVAILABLE_SECTIONS = [
  { id: 'navbar', label: 'Navigation Bar', icon: '🧭' },
  { id: 'hero', label: 'Hero Section', icon: '🏠' },
  { id: 'features', label: 'Features', icon: '✨' },
  { id: 'pricing', label: 'Pricing', icon: '💰' },
  { id: 'testimonials', label: 'Testimonials', icon: '💬' },
  { id: 'contact', label: 'Contact Form', icon: '📧' },
  { id: 'footer', label: 'Footer', icon: '📌' },
  { id: 'sidebar', label: 'Sidebar', icon: '📋' },
  { id: 'dashboard', label: 'Dashboard Grid', icon: '📊' },
  { id: 'table', label: 'Data Table', icon: '📋' },
];

interface BlueprintDesignerProps {
  onGenerate: (options: DesignOptions) => void;
}

export function BlueprintDesigner({ onGenerate }: BlueprintDesignerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<DesignOptions>({
    colorScheme: 'dark',
    typography: 'sans',
    layout: 'topnav',
    style: 'minimal',
    sections: ['navbar', 'hero', 'features', 'footer'],
  });

  const toggleSection = (id: string) => {
    setOptions(prev => ({
      ...prev,
      sections: prev.sections.includes(id)
        ? prev.sections.filter(s => s !== id)
        : [...prev.sections, id],
    }));
  };

  const steps = [
    // Step 0: Template
    <div key="template" className="space-y-3">
      <h3 className="font-semibold text-sm">Choose a base template (optional)</h3>
      <div className="grid grid-cols-2 gap-2">
        <div
          className={cn('border rounded-lg p-3 cursor-pointer transition hover:border-primary/50', !options.templateId && 'border-primary bg-primary/5')}
          onClick={() => setOptions(prev => ({ ...prev, templateId: undefined }))}
        >
          <span className="text-2xl block mb-1">🆕</span>
          <p className="text-xs font-medium">From Scratch</p>
        </div>
        {TEMPLATES.slice(0, 5).map(t => (
          <div
            key={t.id}
            className={cn('border rounded-lg p-3 cursor-pointer transition hover:border-primary/50', options.templateId === t.id && 'border-primary bg-primary/5')}
            onClick={() => setOptions(prev => ({ ...prev, templateId: t.id }))}
          >
            <span className="text-2xl block mb-1">{t.icon}</span>
            <p className="text-xs font-medium">{t.name}</p>
          </div>
        ))}
      </div>
    </div>,

    // Step 1: Sections
    <div key="sections" className="space-y-3">
      <h3 className="font-semibold text-sm">Select sections to include</h3>
      <div className="grid grid-cols-2 gap-2">
        {AVAILABLE_SECTIONS.map(s => (
          <label
            key={s.id}
            className={cn('flex items-center gap-2 border rounded-lg p-2.5 cursor-pointer transition', options.sections.includes(s.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-secondary/20')}
          >
            <Checkbox checked={options.sections.includes(s.id)} onCheckedChange={() => toggleSection(s.id)} />
            <span className="text-sm">{s.icon}</span>
            <span className="text-xs">{s.label}</span>
          </label>
        ))}
      </div>
    </div>,

    // Step 2: Style
    <div key="style" className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-2">Color Scheme</h3>
        <div className="flex gap-2">
          {(['dark', 'light', 'custom'] as const).map(c => (
            <Button key={c} size="sm" variant={options.colorScheme === c ? 'default' : 'outline'} className="text-xs capitalize" onClick={() => setOptions(prev => ({ ...prev, colorScheme: c }))}>{c}</Button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Typography</h3>
        <div className="flex gap-2">
          {(['sans', 'serif', 'mono'] as const).map(t => (
            <Button key={t} size="sm" variant={options.typography === t ? 'default' : 'outline'} className={cn('text-xs capitalize', t === 'serif' && 'font-serif', t === 'mono' && 'font-mono')} onClick={() => setOptions(prev => ({ ...prev, typography: t }))}>{t}</Button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Layout</h3>
        <div className="flex gap-2">
          {(['topnav', 'sidebar', 'fullwidth'] as const).map(l => (
            <Button key={l} size="sm" variant={options.layout === l ? 'default' : 'outline'} className="text-xs capitalize" onClick={() => setOptions(prev => ({ ...prev, layout: l }))}>{l}</Button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Style</h3>
        <div className="flex gap-2">
          {(['minimal', 'corporate', 'playful'] as const).map(s => (
            <Button key={s} size="sm" variant={options.style === s ? 'default' : 'outline'} className="text-xs capitalize" onClick={() => setOptions(prev => ({ ...prev, style: s }))}>{s}</Button>
          ))}
        </div>
      </div>
    </div>,

    // Step 3: Preview
    <div key="preview" className="space-y-3">
      <h3 className="font-semibold text-sm">Layout Preview</h3>
      <WireframePreview options={options} />
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{options.colorScheme} mode</Badge>
        <Badge variant="secondary" className="text-[10px]">{options.typography} font</Badge>
        <Badge variant="secondary" className="text-[10px]">{options.layout} layout</Badge>
        <Badge variant="secondary" className="text-[10px]">{options.style} style</Badge>
        <Badge variant="outline" className="text-[10px]">{options.sections.length} sections</Badge>
      </div>
    </div>,
  ];

  const stepLabels = ['Template', 'Sections', 'Style', 'Preview'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Wand2 className="w-3.5 h-3.5" />
          Blueprint Designer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" /> Blueprint Designer
          </DialogTitle>
          <DialogDescription>Design your project layout step by step</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1">
              <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-muted')} />
              <p className={cn('text-[10px] mt-1 text-center', i <= step ? 'text-foreground' : 'text-muted-foreground')}>{label}</p>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[250px]">{steps[step]}</div>

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => { onGenerate(options); setOpen(false); setStep(0); }}>
              <Wand2 className="w-4 h-4 mr-1" /> Generate Project
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
