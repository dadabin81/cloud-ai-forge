
-- Playground projects table for persisting user projects
CREATE TABLE public.playground_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  files JSONB NOT NULL DEFAULT '{}',
  template TEXT DEFAULT 'vanilla-js',
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.playground_projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users can view their own projects"
ON public.playground_projects FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own projects
CREATE POLICY "Users can create their own projects"
ON public.playground_projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update their own projects"
ON public.playground_projects FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
ON public.playground_projects FOR DELETE
USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_playground_projects_updated_at
BEFORE UPDATE ON public.playground_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
