
-- Deployments table
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.playground_projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'cloudflare-pages',
  project_name TEXT NOT NULL,
  deployment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deployments"
ON public.deployments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments"
ON public.deployments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments"
ON public.deployments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments"
ON public.deployments FOR DELETE
USING (auth.uid() = user_id);

-- User deploy configs table
CREATE TABLE public.user_deploy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'cloudflare',
  account_id TEXT,
  encrypted_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_deploy_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deploy config"
ON public.user_deploy_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deploy config"
ON public.user_deploy_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deploy config"
ON public.user_deploy_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_deploy_configs_updated_at
BEFORE UPDATE ON public.user_deploy_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
