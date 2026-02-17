import { supabase } from '@/integrations/supabase/client';
import type { ProjectFile } from '@/lib/projectGenerator';

export interface DeployConfig {
  projectName: string;
  accountId: string;
  apiToken: string;
}

export interface DeployResult {
  success: boolean;
  url?: string;
  error?: string;
  deploymentId?: string;
}

/**
 * Deploy project files to Cloudflare Pages via backend function
 */
export async function deployToCloudflare(
  files: Record<string, ProjectFile>,
  config: DeployConfig,
  projectId?: string
): Promise<DeployResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await supabase.functions.invoke('deploy-cloudflare', {
    body: {
      files,
      projectName: config.projectName,
      accountId: config.accountId,
      apiToken: config.apiToken,
      playgroundProjectId: projectId,
    },
  });

  if (error) return { success: false, error: error.message };
  return data as DeployResult;
}

/**
 * Save deploy credentials for reuse
 */
export async function saveDeployConfig(accountId: string, apiToken: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_deploy_configs' as any)
    .upsert({
      user_id: user.id,
      account_id: accountId,
      encrypted_token: apiToken, // In production, encrypt client-side before storing
    } as any, { onConflict: 'user_id' });

  return !error;
}

/**
 * Load saved deploy credentials
 */
export async function loadDeployConfig(): Promise<{ accountId: string; apiToken: string } | null> {
  const { data, error } = await supabase
    .from('user_deploy_configs' as any)
    .select('account_id, encrypted_token')
    .single();

  if (error || !data) return null;
  const row = data as any;
  return { accountId: row.account_id || '', apiToken: row.encrypted_token || '' };
}

/**
 * Load deployment history for a project
 */
export async function loadDeployments(projectId: string) {
  const { data, error } = await supabase
    .from('deployments' as any)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data as any[];
}
