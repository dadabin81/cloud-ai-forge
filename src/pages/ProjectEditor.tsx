import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  RefreshCw,
  ChevronLeft,
  File,
  Folder,
  Plus,
  Trash2,
  Save,
  Send,
  ExternalLink,
  Terminal,
  MessageSquare,
  Files,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ProjectFile {
  path: string;
  content: string;
}

interface Project {
  id: string;
  name: string;
  template: string;
  status: 'creating' | 'ready' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  fileCount: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { apiKey } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<{ path: string; size: number }[]>([]);
  const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(['$ Welcome to Binario Terminal']);
  const [terminalInput, setTerminalInput] = useState('');
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = 'https://binario-api.pfrancisco.workers.dev';

  useEffect(() => {
    if (apiKey && projectId) {
      fetchProject();
    } else if (!apiKey) {
      navigate('/auth');
    }
  }, [apiKey, projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchProject = async () => {
    if (!apiKey || !projectId) return;

    setIsLoading(true);
    try {
      const [projectRes, filesRes] = await Promise.all([
        fetch(`${API_BASE}/v1/projects/${projectId}`, {
          headers: { 'X-API-Key': apiKey },
        }),
        fetch(`${API_BASE}/v1/projects/${projectId}/files`, {
          headers: { 'X-API-Key': apiKey },
        }),
      ]);

      if (!projectRes.ok) throw new Error('Project not found');

      const projectData = await projectRes.json();
      const filesData = await filesRes.json();

      setProject(projectData);
      setFiles(filesData.files || []);

      // Auto-open main file based on template
      const mainFile = filesData.files?.find((f: any) => 
        f.path === 'src/App.jsx' || 
        f.path === 'index.js' || 
        f.path === 'app.py' ||
        f.path === 'index.html'
      );
      if (mainFile) {
        openFile(mainFile.path);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        variant: 'destructive',
      });
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  };

  const openFile = async (path: string) => {
    if (!apiKey || !projectId) return;

    // Check if already open
    const existing = openFiles.find(f => f.path === path);
    if (existing) {
      setActiveFile(path);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
        headers: { 'X-API-Key': apiKey },
      });

      if (!res.ok) throw new Error('Failed to open file');

      const data = await res.json();
      setOpenFiles(prev => [...prev, { path, content: data.content }]);
      setActiveFile(path);
    } catch (error) {
      console.error('Failed to open file:', error);
      toast({
        title: 'Error',
        description: 'Failed to open file',
        variant: 'destructive',
      });
    }
  };

  const closeFile = (path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    if (activeFile === path) {
      const remaining = openFiles.filter(f => f.path !== path);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const updateFileContent = (path: string, content: string) => {
    setOpenFiles(prev => prev.map(f => 
      f.path === path ? { ...f, content } : f
    ));
  };

  const saveFile = async () => {
    if (!apiKey || !projectId || !activeFile) return;

    const file = openFiles.find(f => f.path === activeFile);
    if (!file) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          operations: [{
            path: file.path,
            content: file.content,
            action: 'update',
          }],
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast({
        title: 'Saved',
        description: `${file.path} saved successfully`,
      });
    } catch (error) {
      console.error('Failed to save:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startProject = async () => {
    if (!apiKey || !projectId) return;

    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/start`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });

      if (!res.ok) throw new Error('Failed to start');

      const data = await res.json();
      setProject(prev => prev ? { ...prev, status: 'running', previewUrl: data.previewUrl } : null);
      setTerminalOutput(prev => [...prev, '$ npm run dev', 'Starting development server...']);

      toast({
        title: 'Project Started',
        description: 'Development server is running',
      });
    } catch (error) {
      console.error('Failed to start:', error);
      toast({
        title: 'Error',
        description: 'Failed to start project',
        variant: 'destructive',
      });
    }
  };

  const stopProject = async () => {
    if (!apiKey || !projectId) return;

    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/stop`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });

      if (!res.ok) throw new Error('Failed to stop');

      setProject(prev => prev ? { ...prev, status: 'stopped', previewUrl: undefined } : null);
      setTerminalOutput(prev => [...prev, 'Server stopped.']);

      toast({
        title: 'Project Stopped',
        description: 'Development server has been stopped',
      });
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const runCommand = async () => {
    if (!apiKey || !projectId || !terminalInput.trim()) return;

    const command = terminalInput.trim();
    setTerminalOutput(prev => [...prev, `$ ${command}`]);
    setTerminalInput('');

    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          command: command.split(' ')[0],
          args: command.split(' ').slice(1),
        }),
      });

      const data = await res.json();
      if (data.stdout) {
        setTerminalOutput(prev => [...prev, data.stdout]);
      }
      if (data.stderr) {
        setTerminalOutput(prev => [...prev, `Error: ${data.stderr}`]);
      }
    } catch (error) {
      setTerminalOutput(prev => [...prev, `Error: ${error}`]);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatting(true);

    try {
      // In a real implementation, this would call the AI agent
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000));

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `I'll help you with "${userMessage.content}". Let me analyze the project and make the necessary changes...`,
        timestamp: Date.now(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsChatting(false);
    }
  };

  const currentFile = openFiles.find(f => f.path === activeFile);
  const getFileName = (path: string) => path.split('/').pop() || path;
  const getFileIcon = (path: string) => {
    if (path.endsWith('/')) return <Folder className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Project not found</h2>
          <Button className="mt-4" onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">{project.template}</p>
          </div>
          <Badge variant={project.status === 'running' ? 'default' : 'secondary'}>
            {project.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={saveFile} disabled={isSaving || !activeFile}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          
          {project.status === 'running' ? (
            <>
              <Button variant="outline" size="sm" onClick={stopProject}>
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
              {project.previewUrl && (
                <Button size="sm" onClick={() => window.open(project.previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" onClick={startProject}>
              <Play className="h-4 w-4 mr-2" />
              Run
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <aside className="w-60 border-r bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Files className="h-4 w-4" />
              Files
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {files.map((file) => (
                <button
                  key={file.path}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left",
                    activeFile === file.path && "bg-accent"
                  )}
                  onClick={() => openFile(file.path)}
                >
                  {getFileIcon(file.path)}
                  <span className="truncate">{file.path}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="h-10 border-b flex items-center bg-muted/30 overflow-x-auto">
              {openFiles.map((file) => (
                <button
                  key={file.path}
                  className={cn(
                    "h-full px-4 flex items-center gap-2 text-sm border-r hover:bg-accent",
                    activeFile === file.path && "bg-background"
                  )}
                  onClick={() => setActiveFile(file.path)}
                >
                  <File className="h-3 w-3" />
                  {getFileName(file.path)}
                  <span
                    className="ml-1 hover:bg-muted rounded p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            {currentFile ? (
              <textarea
                ref={editorRef}
                className="w-full h-full p-4 font-mono text-sm bg-background resize-none outline-none"
                value={currentFile.content}
                onChange={(e) => updateFileContent(currentFile.path, e.target.value)}
                spellCheck={false}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Select a file to edit
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - AI Chat & Terminal */}
        <aside className="w-80 border-l bg-card flex flex-col">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b h-10">
              <TabsTrigger value="chat" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-2" />
                AI Chat
              </TabsTrigger>
              <TabsTrigger value="terminal" className="flex-1">
                <Terminal className="h-4 w-4 mr-2" />
                Terminal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ask the AI to help you build!</p>
                      <p className="text-xs mt-1">e.g., "Add a dark mode toggle"</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-lg text-sm",
                          msg.role === 'user'
                            ? "bg-primary text-primary-foreground ml-8"
                            : "bg-muted mr-8"
                        )}
                      >
                        {msg.content}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask AI to help..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    disabled={isChatting}
                  />
                  <Button size="icon" onClick={sendChatMessage} disabled={isChatting}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="terminal" className="flex-1 flex flex-col m-0">
              <ScrollArea className="flex-1 p-4 font-mono text-xs">
                {terminalOutput.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </ScrollArea>
              
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-mono">$</span>
                  <Input
                    className="font-mono text-sm"
                    placeholder="Enter command..."
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runCommand()}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
