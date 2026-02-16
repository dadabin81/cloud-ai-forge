import { cn } from '@/lib/utils';

interface StatsCardProps {
  value: string;
  label: string;
  className?: string;
}

export function StatsCard({ value, label, className }: StatsCardProps) {
  return (
    <div className={cn('text-center', className)}>
      <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  );
}
