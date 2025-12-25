import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Zap, AlertCircle } from 'lucide-react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectionStatusProps {
  wsStatus: ConnectionStatus;
  useWebSocket: boolean;
  isApiKeyValid: boolean | null;
  className?: string;
}

export function ConnectionStatus({ 
  wsStatus, 
  useWebSocket, 
  isApiKeyValid,
  className 
}: ConnectionStatusProps) {
  const getStatusInfo = () => {
    if (!isApiKeyValid) {
      return {
        color: 'bg-amber-500',
        text: 'API Key Required',
        icon: AlertCircle,
      };
    }

    if (!useWebSocket) {
      return {
        color: 'bg-emerald-500',
        text: 'HTTP Ready',
        icon: Zap,
      };
    }

    switch (wsStatus) {
      case 'connected':
        return {
          color: 'bg-emerald-500',
          text: 'Connected',
          icon: Wifi,
        };
      case 'connecting':
        return {
          color: 'bg-amber-500 animate-pulse',
          text: 'Connecting...',
          icon: Wifi,
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Connection Error',
          icon: WifiOff,
        };
      default:
        return {
          color: 'bg-muted-foreground',
          text: 'Disconnected',
          icon: WifiOff,
        };
    }
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs',
        className
      )}
    >
      <div className={cn('w-2 h-2 rounded-full', status.color)} />
      <Icon className="w-3 h-3 text-muted-foreground" />
      <span className="text-muted-foreground">{status.text}</span>
    </div>
  );
}
