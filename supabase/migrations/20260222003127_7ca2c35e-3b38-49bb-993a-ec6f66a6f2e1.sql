
-- Community Template Marketplace
CREATE TABLE public.community_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'landing',
  icon TEXT NOT NULL DEFAULT '🚀',
  stack TEXT[] NOT NULL DEFAULT '{}',
  files JSONB NOT NULL DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can browse templates
CREATE POLICY "Templates are publicly readable"
  ON public.community_templates FOR SELECT
  USING (true);

-- Authenticated users can publish
CREATE POLICY "Users can create templates"
  ON public.community_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update
CREATE POLICY "Users can update own templates"
  ON public.community_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- Owners can delete
CREATE POLICY "Users can delete own templates"
  ON public.community_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Likes table
CREATE TABLE public.template_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.community_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, user_id)
);

ALTER TABLE public.template_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are publicly readable"
  ON public.template_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like templates"
  ON public.template_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike templates"
  ON public.template_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update likes_count
CREATE OR REPLACE FUNCTION public.update_template_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_templates SET likes_count = likes_count + 1 WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_templates SET likes_count = likes_count - 1 WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_likes_count
  AFTER INSERT OR DELETE ON public.template_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_template_likes_count();

-- Trigger for updated_at
CREATE TRIGGER update_community_templates_updated_at
  BEFORE UPDATE ON public.community_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_community_templates_category ON public.community_templates(category);
CREATE INDEX idx_community_templates_user ON public.community_templates(user_id);
CREATE INDEX idx_community_templates_featured ON public.community_templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_template_likes_user ON public.template_likes(user_id);
