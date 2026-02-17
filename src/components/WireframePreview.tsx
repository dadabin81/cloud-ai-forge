import { cn } from '@/lib/utils';
import type { DesignOptions } from '@/components/BlueprintDesigner';

interface WireframePreviewProps {
  options: DesignOptions;
}

export function WireframePreview({ options }: WireframePreviewProps) {
  const { sections, layout, colorScheme, style } = options;
  const isDark = colorScheme === 'dark';
  const bg = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const border = isDark ? 'border-gray-700' : 'border-gray-300';
  const textColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const blockBg = isDark ? 'bg-gray-800' : 'bg-gray-200';
  const accentBg = style === 'playful' ? 'bg-purple-500/20' : style === 'corporate' ? 'bg-blue-500/20' : 'bg-primary/10';

  const renderSection = (id: string) => {
    switch (id) {
      case 'navbar':
        return (
          <div key={id} className={cn('flex items-center justify-between px-3 py-1.5 border-b', border)}>
            <div className={cn('w-12 h-2 rounded', blockBg)} />
            <div className="flex gap-2">
              <div className={cn('w-8 h-2 rounded', blockBg)} />
              <div className={cn('w-8 h-2 rounded', blockBg)} />
              <div className={cn('w-10 h-3 rounded', accentBg)} />
            </div>
          </div>
        );
      case 'hero':
        return (
          <div key={id} className="flex flex-col items-center justify-center py-6 px-4 gap-2">
            <div className={cn('w-32 h-3 rounded', blockBg)} />
            <div className={cn('w-24 h-2 rounded', blockBg, 'opacity-60')} />
            <div className="flex gap-2 mt-1">
              <div className={cn('w-12 h-3 rounded', accentBg)} />
              <div className={cn('w-12 h-3 rounded border', border)} />
            </div>
          </div>
        );
      case 'features':
        return (
          <div key={id} className="px-4 py-3">
            <div className={cn('w-16 h-2 rounded mx-auto mb-2', blockBg)} />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('rounded-lg p-2 border', border)}>
                  <div className={cn('w-4 h-4 rounded mb-1', accentBg)} />
                  <div className={cn('w-10 h-1.5 rounded mb-1', blockBg)} />
                  <div className={cn('w-full h-1 rounded', blockBg, 'opacity-40')} />
                </div>
              ))}
            </div>
          </div>
        );
      case 'pricing':
        return (
          <div key={id} className="px-4 py-3">
            <div className={cn('w-14 h-2 rounded mx-auto mb-2', blockBg)} />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('rounded-lg p-2 border', border, i === 1 && 'border-primary/50 scale-[1.02]')}>
                  <div className={cn('w-8 h-1.5 rounded mb-1', blockBg)} />
                  <div className={cn('w-6 h-2 rounded mb-1', blockBg)} />
                  <div className="space-y-0.5">
                    {[0, 1].map(j => <div key={j} className={cn('w-full h-1 rounded', blockBg, 'opacity-40')} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'testimonials':
        return (
          <div key={id} className="px-4 py-3">
            <div className={cn('w-16 h-2 rounded mx-auto mb-2', blockBg)} />
            <div className="flex gap-2">
              {[0, 1].map(i => (
                <div key={i} className={cn('flex-1 rounded-lg p-2 border', border)}>
                  <div className={cn('w-full h-1 rounded mb-1', blockBg, 'opacity-40')} />
                  <div className="flex items-center gap-1 mt-1">
                    <div className={cn('w-3 h-3 rounded-full', accentBg)} />
                    <div className={cn('w-8 h-1 rounded', blockBg)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'contact':
        return (
          <div key={id} className="px-4 py-3">
            <div className={cn('w-14 h-2 rounded mx-auto mb-2', blockBg)} />
            <div className="max-w-[60%] mx-auto space-y-1.5">
              <div className={cn('w-full h-3 rounded border', border)} />
              <div className={cn('w-full h-3 rounded border', border)} />
              <div className={cn('w-16 h-3 rounded mx-auto', accentBg)} />
            </div>
          </div>
        );
      case 'footer':
        return (
          <div key={id} className={cn('flex items-center justify-between px-3 py-1.5 border-t', border)}>
            <div className={cn('w-16 h-1.5 rounded', blockBg, 'opacity-40')} />
            <div className="flex gap-2">
              {[0, 1, 2].map(i => <div key={i} className={cn('w-6 h-1 rounded', blockBg, 'opacity-40')} />)}
            </div>
          </div>
        );
      case 'sidebar':
        return null; // handled by layout
      case 'dashboard':
        return (
          <div key={id} className="px-4 py-3">
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={cn('rounded-lg p-2 border', border)}>
                  <div className={cn('w-6 h-1.5 rounded mb-1', blockBg, 'opacity-40')} />
                  <div className={cn('w-10 h-2 rounded', blockBg)} />
                </div>
              ))}
            </div>
            <div className={cn('rounded-lg p-2 border h-10', border)} />
          </div>
        );
      case 'table':
        return (
          <div key={id} className="px-4 py-3">
            <div className={cn('rounded-lg border overflow-hidden', border)}>
              <div className={cn('flex gap-4 px-2 py-1 border-b', border, blockBg)}>
                {[0, 1, 2, 3].map(i => <div key={i} className={cn('w-10 h-1.5 rounded', isDark ? 'bg-gray-600' : 'bg-gray-400')} />)}
              </div>
              {[0, 1].map(r => (
                <div key={r} className={cn('flex gap-4 px-2 py-1.5 border-b last:border-0', border)}>
                  {[0, 1, 2, 3].map(i => <div key={i} className={cn('w-10 h-1 rounded', blockBg, 'opacity-60')} />)}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const hasSidebar = layout === 'sidebar' || sections.includes('sidebar');
  const mainSections = sections.filter(s => s !== 'sidebar');

  return (
    <div className={cn('rounded-xl border overflow-hidden', border, bg, 'text-xs', textColor)} style={{ minHeight: 200 }}>
      {hasSidebar ? (
        <div className="flex" style={{ minHeight: 200 }}>
          <div className={cn('w-[60px] border-r p-2 flex flex-col gap-1.5', border)}>
            <div className={cn('w-8 h-2 rounded mb-2', blockBg)} />
            {[0, 1, 2, 3].map(i => <div key={i} className={cn('w-full h-2 rounded', blockBg, 'opacity-50')} />)}
          </div>
          <div className="flex-1">{mainSections.map(renderSection)}</div>
        </div>
      ) : (
        <div>{mainSections.map(renderSection)}</div>
      )}
    </div>
  );
}
