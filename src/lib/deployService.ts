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
 * Deploy project files to Cloudflare Pages via backend function.
 * Uses the Cloudflare auth token for authentication (not Supabase auth).
 */
export async function deployToCloudflare(
  files: Record<string, ProjectFile>,
  config: DeployConfig,
  projectId?: string
): Promise<DeployResult> {
  // Try Cloudflare token first (primary auth), fall back to Supabase session
  const cloudflareToken = localStorage.getItem('binario_token');

  if (cloudflareToken) {
    // Use edge function with Cloudflare token
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-cloudflare`;
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudflareToken}`,
      },
      body: JSON.stringify({
        files,
        projectName: config.projectName,
        accountId: config.accountId,
        apiToken: config.apiToken,
        playgroundProjectId: projectId,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }

    return await res.json() as DeployResult;
  }

  // Fallback: Supabase auth
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
    .from('user_deploy_configs')
    .upsert({
      user_id: user.id,
      account_id: accountId,
      encrypted_token: apiToken,
    }, { onConflict: 'user_id' });

  return !error;
}

/**
 * Load saved deploy credentials
 */
export async function loadDeployConfig(): Promise<{ accountId: string; apiToken: string } | null> {
  const { data, error } = await supabase
    .from('user_deploy_configs')
    .select('account_id, encrypted_token')
    .single();

  if (error || !data) return null;
  return { accountId: data.account_id || '', apiToken: data.encrypted_token || '' };
}

/**
 * Load deployment history for a project
 */
export async function loadDeployments(projectId: string) {
  const { data, error } = await supabase
    .from('deployments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data;
}
