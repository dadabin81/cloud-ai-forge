import { FileCode, Package, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Blueprint } from '@/lib/blueprintSystem';

interface BlueprintCardProps {
  blueprint: Blueprint;
  onApprove: () => void;
  onModify: () => void;
}

export function BlueprintCard({ blueprint, onApprove, onModify }: BlueprintCardProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">{blueprint.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{blueprint.description}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Blueprint</Badge>
      </div>

      {/* Files */}
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Files</span>
        <div className="flex flex-wrap gap-1.5">
          {blueprint.files.map((f) => (
            <div key={f.path} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/50 text-xs" title={f.description}>
              <FileCode className="w-3 h-3 text-muted-foreground" />
              {f.path}
            </div>
          ))}
        </div>
      </div>

      {/* CDN Dependencies */}
      {blueprint.cdnDependencies.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dependencies</span>
          <div className="flex flex-wrap gap-1.5">
            {blueprint.cdnDependencies.map((dep) => (
              <div key={dep} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/50 text-xs">
                <Package className="w-3 h-3 text-muted-foreground" />
                {dep}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApprove} className="flex-1 h-8 gap-1.5">
          <Check className="w-3.5 h-3.5" /> Aprobar
        </Button>
        <Button size="sm" variant="outline" onClick={onModify} className="flex-1 h-8 gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Modificar
        </Button>
      </div>
    </div>
  );
}
