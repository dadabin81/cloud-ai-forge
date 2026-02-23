import { useState, useRef } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Image, Mic, Languages, Database,
  Send, Loader2, Upload, Copy, Check, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { API_CONFIG } from '@/config/api';
import { Link } from 'react-router-dom';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
];

export default function AITools() {
  const { apiKey, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-20 pb-16 px-4 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Prueba directa</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            AI <span className="gradient-text">Tools</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Prueba las capacidades AI de Cloudflare directamente. Sin código, sin IDE — solo resultados.
          </p>
        </div>

        {!isAuthenticated || !apiKey ? (
          <Card className="bg-secondary/30 border-border/50">
            <CardContent className="p-8 text-center">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Inicia sesión para probar</h2>
              <p className="text-muted-foreground mb-4">
                Necesitas una cuenta y API key para usar las herramientas AI.
              </p>
              <Link to="/auth">
                <Button variant="hero">Iniciar sesión</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="chat" className="space-y-4">
            <TabsList className="bg-secondary/50 border border-border/50">
              <TabsTrigger value="chat" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Chat</TabsTrigger>
              <TabsTrigger value="images" className="gap-1.5"><Image className="w-3.5 h-3.5" />Imágenes</TabsTrigger>
              <TabsTrigger value="audio" className="gap-1.5"><Mic className="w-3.5 h-3.5" />Audio</TabsTrigger>
              <TabsTrigger value="translate" className="gap-1.5"><Languages className="w-3.5 h-3.5" />Traducción</TabsTrigger>
              <TabsTrigger value="embeddings" className="gap-1.5"><Database className="w-3.5 h-3.5" />Embeddings</TabsTrigger>
            </TabsList>

            <TabsContent value="chat"><ChatTool apiKey={apiKey} /></TabsContent>
            <TabsContent value="images"><ImageTool apiKey={apiKey} /></TabsContent>
            <TabsContent value="audio"><AudioTool apiKey={apiKey} /></TabsContent>
            <TabsContent value="translate"><TranslateTool apiKey={apiKey} /></TabsContent>
            <TabsContent value="embeddings"><EmbeddingsTool apiKey={apiKey} /></TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ── Chat Tool ── */
function ChatTool({ apiKey }: { apiKey: string }) {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: input }], model: '@cf/meta/llama-3.1-8b-instruct' }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setResponse(data.choices?.[0]?.message?.content || JSON.stringify(data));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardHeader><CardTitle className="text-lg">Chat con Llama 3.1</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe tu mensaje..." rows={3} />
        <Button onClick={send} disabled={loading || !input.trim()} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar
        </Button>
        {response && (
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <p className="text-sm whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Image Tool ── */
function ImageTool({ apiKey }: { apiKey: string }) {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setImageUrl('');
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/v1/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ prompt, model: '@cf/black-forest-labs/flux-1-schnell' }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      setImageUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardHeader><CardTitle className="text-lg">Generación de Imágenes con Flux</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe la imagen que quieres generar..." />
        <Button onClick={generate} disabled={loading || !prompt.trim()} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
          Generar
        </Button>
        {imageUrl && (
          <div className="rounded-lg overflow-hidden border border-border/30">
            <img src={imageUrl} alt={prompt} className="w-full max-h-[512px] object-contain bg-background/50" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Audio Tool ── */
function AudioTool({ apiKey }: { apiKey: string }) {
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const transcribe = async (file: File) => {
    setLoading(true);
    setTranscription('');
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_CONFIG.baseUrl}/v1/audio/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setTranscription(data.text || JSON.stringify(data));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardHeader><CardTitle className="text-lg">Transcripción de Audio con Whisper</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && transcribe(e.target.files[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {fileName || 'Subir archivo de audio'}
        </Button>
        {transcription && (
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <Badge className="mb-2">Transcripción</Badge>
            <p className="text-sm whitespace-pre-wrap">{transcription}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Translate Tool ── */
function TranslateTool({ apiKey }: { apiKey: string }) {
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState('es');
  const [targetLang, setTargetLang] = useState('en');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const translate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setResult(data.translated_text || data.text || JSON.stringify(data));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardHeader><CardTitle className="text-lg">Traducción con M2M100</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <span className="self-center text-muted-foreground">→</span>
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Texto a traducir..." rows={3} />
        <Button onClick={translate} disabled={loading || !text.trim()} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          Traducir
        </Button>
        {result && (
          <div className="bg-background/50 rounded-lg p-4 border border-border/30 relative">
            <p className="text-sm whitespace-pre-wrap pr-8">{result}</p>
            <Button
              variant="ghost" size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Embeddings Tool ── */
function EmbeddingsTool({ apiKey }: { apiKey: string }) {
  const [text, setText] = useState('');
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setEmbedding(null);
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: text, model: '@cf/baai/bge-small-en-v1.5' }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setEmbedding(data.data?.[0]?.embedding || data.embedding || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardHeader><CardTitle className="text-lg">Embeddings con BGE</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Texto para generar embedding..." rows={2} />
        <Button onClick={generate} disabled={loading || !text.trim()} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Generar vector
        </Button>
        {embedding && (
          <div className="bg-background/50 rounded-lg p-4 border border-border/30 space-y-2">
            <div className="flex items-center gap-2">
              <Badge>{embedding.length} dimensiones</Badge>
            </div>
            <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-32">
              [{embedding.slice(0, 20).map(v => v.toFixed(6)).join(', ')}{embedding.length > 20 ? ', ...' : ''}]
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
