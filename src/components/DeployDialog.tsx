import { useState, useEffect } from 'react';
import { Rocket, ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { deployToCloudflare, saveDeployConfig, loadDeployConfig, loadDeployments } from '@/lib/deployService';
import type { ProjectFile } from '@/lib/projectGenerator';

interface DeployDialogProps {
  files: Record<string, ProjectFile>;
  projectId?: string;
  projectName?: string;
  hasFiles: boolean;
}

export function DeployDialog({ files, projectId, projectName, hasFiles }: DeployDialogProps) {
  const [open, setOpen] = useState(false);
  const [deployName, setDeployName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load saved config and history when dialog opens
  useEffect(() => {
    if (!open) return;
    setDeployName(projectName?.replace(/\s+/g, '-').toLowerCase() || 'my-project');
    setDeployUrl(null);

    loadDeployConfig().then(config => {
      if (config) {
        setAccountId(config.accountId);
        setApiToken(config.apiToken);
        setConfigLoaded(true);
      }
    });

    if (projectId) {
      loadDeployments(projectId).then(setDeployments);
    }
  }, [open, projectId, projectName]);

  const handleDeploy = async () => {
    if (!deployName.trim() || !accountId.trim() || !apiToken.trim()) {
      toast.error('All fields are required');
      return;
    }

    setIsDeploying(true);
    try {
      // Save config for future use
      await saveDeployConfig(accountId, apiToken);

      const result = await deployToCloudflare(files, {
        projectName: deployName.trim(),
        accountId: accountId.trim(),
        apiToken: apiToken.trim(),
      }, projectId);

      if (result.success && result.url) {
        setDeployUrl(result.url);
        toast.success('Deployed successfully!');
        // Refresh history
        if (projectId) loadDeployments(projectId).then(setDeployments);
      } else {
        toast.error(result.error || 'Deploy failed');
      }
    } catch (err) {
      toast.error('Deploy error: ' + (err as Error).message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" disabled={!hasFiles}>
          <Rocket className="w-3 h-3" />
          Deploy
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">Beta</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" /> Deploy to Cloudflare Pages
          </DialogTitle>
          <DialogDescription>Deploy your project to a live URL</DialogDescription>
        </DialogHeader>

        {deployUrl ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-500">Deployed!</p>
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline truncate block"
                >
                  {deployUrl}
                </a>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" asChild>
                <a href={deployUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" /> Open
                </a>
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setDeployUrl(null)}>
              Deploy Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deploy-name">Project Name (URL slug)</Label>
              <Input
                id="deploy-name"
                value={deployName}
                onChange={e => setDeployName(e.target.value)}
                placeholder="my-project"
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">{deployName}.pages.dev</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-id">Cloudflare Account ID</Label>
              <Input
                id="account-id"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder="abc123..."
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-token">Cloudflare API Token</Label>
              <Input
                id="api-token"
                type="password"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                placeholder="Your CF API Token"
                className="text-sm"
              />
              {configLoaded && (
                <p className="text-[11px] text-emerald-500">✓ Loaded from saved credentials</p>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleDeploy}
                disabled={isDeploying || !deployName.trim() || !accountId.trim() || !apiToken.trim()}
                className="w-full gap-2"
                variant="hero"
              >
                {isDeploying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Deploying...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> Deploy</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Deployment History */}
        {deployments.length > 0 && (
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Recent Deploys</p>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {deployments.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={d.status === 'success' ? 'secondary' : 'destructive'}
                      className="text-[9px] px-1.5 py-0 h-4"
                    >
                      {d.status}
                    </Badge>
                    <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {d.deployment_url && (
                    <a href={d.deployment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
