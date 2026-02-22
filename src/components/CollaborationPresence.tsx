import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Collaborator {
  userId: string;
  email: string;
  color: string;
  cursor?: { file: string; line: number };
  lastSeen: number;
}

const COLORS = [
  'hsl(var(--primary))',
  '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4',
];

interface CollaborationPresenceProps {
  projectId: string;
}

export function CollaborationPresence({ projectId }: CollaborationPresenceProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!user || !projectId) return;

    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const collabs: Collaborator[] = [];
        Object.entries(state).forEach(([userId, presences]) => {
          if (userId === user.id) return;
          const p = (presences as any[])[0];
          if (p) {
            collabs.push({
              userId,
              email: p.email || 'Anonymous',
              color: COLORS[collabs.length % COLORS.length],
              cursor: p.cursor,
              lastSeen: Date.now(),
            });
          }
        });
        setCollaborators(collabs);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, projectId]);

  if (collaborators.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {collaborators.slice(0, 5).map((c, i) => (
        <Tooltip key={c.userId}>
          <TooltipTrigger>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background -ml-1 first:ml-0"
              style={{ backgroundColor: c.color }}
            >
              {c.email[0]?.toUpperCase() || '?'}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{c.email}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      {collaborators.length > 5 && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium -ml-1">
          +{collaborators.length - 5}
        </div>
      )}
    </div>
  );
}
