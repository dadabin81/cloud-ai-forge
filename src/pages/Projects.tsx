import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, Clock, Play, Trash2, ExternalLink, Code2, Globe, Server } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  template: string;
  status: 'creating' | 'ready' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  createdAt: number;
  updatedAt: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'react-vite': <Code2 className="h-5 w-5" />,
  'node-express': <Server className="h-5 w-5" />,
  'python-flask': <Server className="h-5 w-5" />,
  'vanilla-js': <Globe className="h-5 w-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  creating: 'bg-yellow-500/20 text-yellow-500',
  ready: 'bg-blue-500/20 text-blue-500',
  running: 'bg-green-500/20 text-green-500',
  stopped: 'bg-muted text-muted-foreground',
  error: 'bg-destructive/20 text-destructive',
};

export default function Projects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, apiKey } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('react-vite');

  const API_BASE = 'https://binario-api.pfrancisco.workers.dev';

  useEffect(() => {
    fetchTemplates();
    if (apiKey) {
      fetchProjects();
    } else {
      setIsLoading(false);
    }
  }, [apiKey]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/templates`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchProjects = async () => {
    if (!apiKey) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/projects`, {
        headers: { 'X-API-Key': apiKey },
      });
      
      if (!res.ok) throw new Error('Failed to fetch projects');
      
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async () => {
    if (!apiKey || !newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          template: selectedTemplate,
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const data = await res.json();
      
      toast({
        title: 'Project Created',
        description: `${newProjectName} is ready!`,
      });

      setShowCreateDialog(false);
      setNewProjectName('');
      setSelectedTemplate('react-vite');
      
      // Navigate to the new project
      navigate(`/projects/${data.projectId}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    if (!apiKey) return;
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });

      if (!res.ok) throw new Error('Failed to delete project');

      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      toast({
        title: 'Project Deleted',
        description: `${projectName} has been deleted`,
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Sign in to view your projects</h1>
            <p className="text-muted-foreground mb-8">
              Create and manage AI-powered development projects
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your AI-powered development projects
            </p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Choose a template and give your project a name
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="my-awesome-project"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            {TEMPLATE_ICONS[template.id]}
                            <span>{template.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templates.find(t => t.id === selectedTemplate) && (
                    <p className="text-sm text-muted-foreground">
                      {templates.find(t => t.id === selectedTemplate)?.description}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={createProject} 
                  disabled={!newProjectName.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Folder className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Create your first project and let AI help you build it
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {TEMPLATE_ICONS[project.template] || <Folder className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription>{project.template}</CardDescription>
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[project.status]}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDate(project.updatedAt)}
                    </div>
                    
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {project.status === 'running' && project.previewUrl && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(project.previewUrl, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {project.status === 'ready' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Start project
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id, project.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
