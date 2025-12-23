import { cn } from '@/lib/utils';

interface ProviderBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function ProviderBadge({ name, color, className }: ProviderBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'bg-secondary/50 border border-border/50',
        'hover:border-border transition-colors duration-200',
        className
      )}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm font-medium text-foreground">{name}</span>
    </div>
  );
}
