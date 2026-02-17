import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { createCloudflareApi, type HealthStatus } from '@/lib/cloudflareApi';
import { Brain, Database, HardDrive, Search, Workflow, Server, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceBadgesProps {
  apiKey: string;
  onBadgeClick?: (tab: string) => void;
}

interface ResourceInfo {
  id: string;
  label: string;
  icon: React.ElementType;
  tab: string;
  bindingKey: keyof HealthStatus['bindings'];
}

const RESOURCES: ResourceInfo[] = [
  { id: 'ai', label: 'AI', icon: Brain, tab: 'models', bindingKey: 'ai' },
  { id: 'd1', label: 'D1', icon: Database, tab: 'status', bindingKey: 'd1' },
  { id: 'kv', label: 'KV', icon: HardDrive, tab: 'status', bindingKey: 'kv' },
  { id: 'vectorize', label: 'Vec', icon: Search, tab: 'rag', bindingKey: 'vectorize' },
  { id: 'workflows', label: 'WF', icon: Workflow, tab: 'workflows', bindingKey: 'workflows' },
  { id: 'do', label: 'DO', icon: Server, tab: 'sandbox', bindingKey: 'durableObjects' },
];

export function ResourceBadges({ apiKey, onBadgeClick }: ResourceBadgesProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const api = createCloudflareApi(apiKey);
      const data = await api.healthCheck();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading && !health) {
    return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex items-center gap-1">
      {RESOURCES.map(resource => {
        const isActive = health?.bindings?.[resource.bindingKey] ?? false;
        const Icon = resource.icon;
        return (
          <button
            key={resource.id}
            onClick={() => onBadgeClick?.(resource.tab)}
            className="group"
            title={`${resource.label}: ${isActive ? 'Active' : 'Inactive'}`}
          >
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-5 gap-0.5 cursor-pointer transition-all',
                isActive
                  ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-muted text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-2.5 h-2.5" />
              <span className="hidden lg:inline">{resource.label}</span>
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                isActive ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              )} />
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
