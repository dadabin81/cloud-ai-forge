import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Download, Search, Plus, Sparkles, LayoutGrid, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { TEMPLATE_CATEGORIES, type TemplateCategory } from '@/lib/templates';

interface CommunityTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  stack: string[];
  files: Record<string, { code: string; language: string }>;
  likes_count: number;
  uses_count: number;
  is_featured: boolean;
  created_at: string;
}

export default function TemplateMarketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<CommunityTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
    if (user) fetchLikes();
  }, [user]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('community_templates')
      .select('*')
      .order('likes_count', { ascending: false });
    if (!error && data) {
      setTemplates(data.map(t => ({
        ...t,
        stack: t.stack as string[],
        files: t.files as Record<string, { code: string; language: string }>,
      })));
    }
    setIsLoading(false);
  };

  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('template_likes')
      .select('template_id')
      .eq('user_id', user.id);
    if (data) setLikedIds(new Set(data.map(l => l.template_id)));
  };

  const toggleLike = async (templateId: string) => {
    if (!user) { toast.error('Sign in to like templates'); return; }
    const liked = likedIds.has(templateId);
    if (liked) {
      await supabase.from('template_likes').delete().eq('template_id', templateId).eq('user_id', user.id);
      setLikedIds(prev => { const s = new Set(prev); s.delete(templateId); return s; });
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, likes_count: t.likes_count - 1 } : t));
    } else {
      await supabase.from('template_likes').insert({ template_id: templateId, user_id: user.id });
      setLikedIds(prev => new Set(prev).add(templateId));
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, likes_count: t.likes_count + 1 } : t));
    }
  };

  const useTemplate = (template: CommunityTemplate) => {
    // Increment uses_count (fire-and-forget)
    supabase.rpc('increment_uses_count' as never, { template_id: template.id } as never).then();
    navigate(`/playground?communityTemplate=${template.id}`);
    toast.success(`Loading template: ${template.name}`);
  };

  const filtered = templates.filter(t => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesSearch && matchesCategory;
  });

  const featured = templates.filter(t => t.is_featured).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Template Marketplace
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Discover and share project templates built by the community
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => navigate('/playground')} className="gap-2">
              <Plus className="w-4 h-4" /> Publish Your Template
            </Button>
          </div>

          {/* Category tabs */}
          <Tabs value={category} onValueChange={setCategory} className="mb-8">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              {TEMPLATE_CATEGORIES.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-1">
                  <span>{cat.icon}</span> {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Featured Section */}
          {category === 'all' && !search && featured.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Featured Templates
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {featured.map(t => (
                  <Card key={t.id} className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/50 transition-all cursor-pointer" onClick={() => setPreview(t)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{t.icon}</span>
                        <div>
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {t.likes_count}</span>
                        <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {t.uses_count}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Template Grid */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates found</h3>
              <p className="text-muted-foreground text-sm">Be the first to publish one!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(t => (
                <Card
                  key={t.id}
                  className="hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => setPreview(t)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{t.icon}</span>
                        <div>
                          <CardTitle className="text-sm group-hover:text-primary transition">{t.name}</CardTitle>
                          <Badge variant="secondary" className="text-[10px] mt-1">{t.category}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={e => { e.stopPropagation(); toggleLike(t.id); }}
                      >
                        <Heart className={`w-4 h-4 ${likedIds.has(t.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {t.stack.slice(0, 3).map(s => (
                        <Badge key={s} variant="outline" className="text-[9px] px-1.5 py-0">{s}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {t.likes_count}</span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {t.uses_count}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-3xl">{preview?.icon}</span> {preview?.name}
            </DialogTitle>
            <DialogDescription>{preview?.description}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="flex gap-1.5 flex-wrap">
                {preview.stack.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Files included:</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(preview.files).map(f => (
                    <Badge key={f} variant="outline" className="text-[10px] font-mono">{f}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {preview.likes_count} likes</span>
                <span className="flex items-center gap-1"><Download className="w-4 h-4" /> {preview.uses_count} uses</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { useTemplate(preview); setPreview(null); }} className="gap-2">
                  <LayoutGrid className="w-4 h-4" /> Use Template
                </Button>
                <Button variant="outline" onClick={() => { toggleLike(preview.id); }} className="gap-2">
                  <Heart className={`w-4 h-4 ${likedIds.has(preview.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  {likedIds.has(preview.id) ? 'Liked' : 'Like'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
