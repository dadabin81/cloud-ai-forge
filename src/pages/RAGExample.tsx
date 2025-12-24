import { useState, useRef, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  FileText,
  Plus,
  Trash2,
  Search,
  Database,
  Sparkles,
  BookOpen,
  MessageSquare,
  Zap,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  content: string;
  embedding?: number[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  context?: string[];
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
}

// Cloudflare Workers AI Embeddings API
const EMBEDDINGS_API_URL = 'https://binario-api.databin81.workers.dev/v1/embeddings';

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(EMBEDDINGS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      input: text,
      model: '@cf/baai/bge-base-en-v1.5',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as any).error || `API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch(EMBEDDINGS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      input: texts,
      model: '@cf/baai/bge-base-en-v1.5',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as any).error || `API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data.map(d => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Sample documents for the demo
const sampleDocuments = [
  {
    id: 'doc1',
    content: 'Binario is a universal AI SDK for Cloudflare Workers. It provides a unified API for interacting with multiple AI providers including OpenAI, Anthropic, Google, and Mistral.',
  },
  {
    id: 'doc2', 
    content: 'The Memory System in Binario supports four types: BufferMemory for sliding window, SummaryMemory for LLM summarization, SummaryBufferMemory for hybrid approach, and VectorMemory for semantic search.',
  },
  {
    id: 'doc3',
    content: 'Binario includes a powerful Embeddings API using Cloudflare Workers AI. Supported models include bge-small-en-v1.5 (384 dimensions), bge-base-en-v1.5 (768 dimensions), and bge-large-en-v1.5 (1024 dimensions).',
  },
  {
    id: 'doc4',
    content: 'React hooks in Binario include useBinarioChat, useBinarioStream, useBinarioAgent, useBinarioEmbed, and useBinarioSemanticSearch for easy integration in React applications.',
  },
  {
    id: 'doc5',
    content: 'The Agent Framework allows creating AI agents with tool calling capabilities. Define tools using Zod schemas and let the agent reason through multi-step tasks automatically.',
  },
  {
    id: 'doc6',
    content: 'Storage backends in Binario include InMemoryStore for development, LocalStorageStore for browser persistence, and CloudflareKVStore for production with Cloudflare Workers KV.',
  },
];

export default function RAGExample() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [retrievedContext, setRetrievedContext] = useState<SearchResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load sample documents on mount
  const loadSampleDocs = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your API key first');
      return;
    }

    setIsIndexing(true);
    try {
      const contents = sampleDocuments.map(doc => doc.content);
      const embeddings = await generateEmbeddings(contents, apiKey);
      
      const indexed: Document[] = sampleDocuments.map((doc, i) => ({
        ...doc,
        embedding: embeddings[i],
      }));
      
      setDocuments(indexed);
      toast.success(`Indexed ${indexed.length} documents with real embeddings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate embeddings');
    } finally {
      setIsIndexing(false);
    }
  };

  const addDocument = async () => {
    if (!newDocContent.trim()) return;
    if (!apiKey.trim()) {
      toast.error('Please enter your API key first');
      return;
    }
    
    setIsIndexing(true);
    try {
      const embedding = await generateEmbedding(newDocContent.trim(), apiKey);
      const newDoc: Document = {
        id: `doc_${Date.now()}`,
        content: newDocContent.trim(),
        embedding,
      };
      
      setDocuments(prev => [...prev, newDoc]);
      setNewDocContent('');
      toast.success('Document indexed with real embedding');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate embedding');
    } finally {
      setIsIndexing(false);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    toast.success('Document removed');
  };

  const clearDocuments = () => {
    setDocuments([]);
    toast.success('All documents cleared');
  };

  const searchDocuments = async (query: string, topK: number = 3): Promise<SearchResult[]> => {
    if (!query.trim() || documents.length === 0) return [];
    if (!apiKey.trim()) {
      toast.error('Please enter your API key first');
      return [];
    }
    
    try {
      const queryEmbedding = await generateEmbedding(query, apiKey);
      
      const results = documents
        .filter(doc => doc.embedding)
        .map(doc => ({
          id: doc.id,
          content: doc.content,
          score: cosineSimilarity(queryEmbedding, doc.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      
      return results;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate query embedding');
      return [];
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    const results = await searchDocuments(searchQuery, 5);
    setSearchResults(results);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (documents.length === 0) {
      toast.error('Please add some documents first');
      return;
    }

    if (!apiKey.trim()) {
      toast.error('Please enter your API key first');
      return;
    }

    setIsLoading(true);
    
    try {
      // Step 1: Retrieve relevant context using real embeddings
      const relevantDocs = await searchDocuments(input, 3);
      setRetrievedContext(relevantDocs);
      
      const userMessage: Message = { role: 'user', content: input.trim() };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Simulate AI response with RAG (in production, call an LLM API)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Build context-aware response
      let response = '';
      if (relevantDocs.length > 0 && relevantDocs[0].score > 0.5) {
        response = `Based on the documentation:\n\n${relevantDocs[0].content}\n\n`;
        if (relevantDocs.length > 1 && relevantDocs[1].score > 0.4) {
          response += `Additionally, ${relevantDocs[1].content.toLowerCase()}`;
        }
      } else {
        response = "I couldn't find specific information about that in the indexed documents. Try adding more relevant documents or rephrasing your question.";
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        context: relevantDocs.map(d => d.content),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process query');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setRetrievedContext([]);
  };

  const copyCode = () => {
    const code = `import { Binario, CloudflareEmbeddings, createMemory } from 'binario';

// Setup embeddings provider
const embeddings = new CloudflareEmbeddings({
  binding: env.AI,
  model: 'bge-base-en-v1.5',
});

// Create vector memory for RAG
const memory = createMemory({
  type: 'vector',
  options: {
    topK: 3,
    embeddings,
  },
});

// Index documents
for (const doc of documents) {
  await memory.add({ role: 'system', content: doc });
}

// Query with RAG
async function queryWithRAG(question: string) {
  // Retrieve relevant context
  const results = await memory.search(question);
  const context = results.map(r => r.content).join('\\n');
  
  // Generate answer with context
  const response = await client.chat([
    { role: 'system', content: \`Answer based on context:\\n\${context}\` },
    { role: 'user', content: question },
  ]);
  
  return response.content;
}`;
    
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Interactive Demo</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              RAG <span className="gradient-text">Example</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mb-4">
              Retrieval Augmented Generation demo using real Cloudflare Workers AI embeddings.
              Add documents, index them with embeddings, and ask questions with semantic retrieval.
            </p>
            
            {/* API Key Input */}
            <div className="flex items-center gap-3 max-w-md">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Binario API key (bsk_live_...)"
                className="flex-1"
              />
              {apiKey && (
                <Badge variant={apiKey.startsWith('bsk_live_') ? 'default' : 'destructive'}>
                  {apiKey.startsWith('bsk_live_') ? 'Valid format' : 'Invalid format'}
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-secondary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{documents.length}</p>
                    <p className="text-xs text-muted-foreground">Documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">384</p>
                    <p className="text-xs text-muted-foreground">Dimensions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{messages.length}</p>
                    <p className="text-xs text-muted-foreground">Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{retrievedContext.length}</p>
                    <p className="text-xs text-muted-foreground">Retrieved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel - Documents */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Knowledge Base
                  </CardTitle>
                  <CardDescription>
                    Add documents to build your RAG knowledge base
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Document */}
                  <div className="space-y-2">
                    <Textarea
                      value={newDocContent}
                      onChange={(e) => setNewDocContent(e.target.value)}
                      placeholder="Enter document content..."
                      className="min-h-[80px] resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={addDocument}
                        disabled={!newDocContent.trim() || isIndexing}
                        className="flex-1"
                        size="sm"
                      >
                        {isIndexing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add Document
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadSampleDocs}
                      disabled={isIndexing}
                      className="flex-1"
                    >
                      Load Samples
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearDocuments}
                      disabled={documents.length === 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <Separator />

                  {/* Document List */}
                  <ScrollArea className="h-[300px]">
                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documents indexed</p>
                        <p className="text-xs">Add documents or load samples</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-lg bg-secondary/50 border border-border/50 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-foreground line-clamp-3">
                                {doc.content}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeDocument(doc.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {doc.id}
                              </Badge>
                              {doc.embedding && (
                                <Badge variant="outline" className="text-[10px]">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Indexed
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Semantic Search Test */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Semantic Search
                  </CardTitle>
                  <CardDescription>
                    Test vector similarity search
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search query..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button size="icon" onClick={handleSearch} disabled={!searchQuery.trim()}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((result, i) => (
                        <div
                          key={result.id}
                          className="p-2 rounded-lg bg-secondary/30 border border-border/30"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="secondary" className="text-[10px]">
                              #{i + 1}
                            </Badge>
                            <Badge 
                              variant={result.score > 0.7 ? 'default' : result.score > 0.5 ? 'secondary' : 'outline'}
                              className="text-[10px]"
                            >
                              {(result.score * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Chat with RAG */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="chat" className="h-full flex flex-col">
                <TabsList className="mb-4">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    RAG Chat
                  </TabsTrigger>
                  <TabsTrigger value="context" className="gap-2">
                    <BookOpen className="w-4 h-4" />
                    Retrieved Context
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <Zap className="w-4 h-4" />
                    Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
                  {/* Messages */}
                  <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto rounded-xl border border-border bg-secondary/20 p-4 space-y-4">
                    {messages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-center">
                        <div className="space-y-2">
                          <Bot className="w-12 h-12 mx-auto text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            Ask questions about your indexed documents
                          </p>
                          <p className="text-sm text-muted-foreground/70">
                            The AI will retrieve relevant context before answering
                          </p>
                        </div>
                      </div>
                    )}

                    {messages.map((message, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary'
                          )}
                        >
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {message.content}
                          </pre>
                          {message.context && message.context.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground">
                                Retrieved {message.context.length} documents
                              </p>
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="max-w-[80%] rounded-xl px-4 py-3 bg-secondary">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">
                              Retrieving context and generating response...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question about your documents..."
                        className="min-h-[60px] resize-none"
                        disabled={isLoading}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || documents.length === 0}
                        className="h-auto"
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearChat}
                        disabled={messages.length === 0}
                      >
                        Clear Chat
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {documents.length} documents indexed • Top 3 retrieval
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="context" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Retrieved Context</CardTitle>
                      <CardDescription>
                        Documents retrieved for the last query using semantic similarity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {retrievedContext.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No context retrieved yet</p>
                          <p className="text-xs">Ask a question to see retrieved documents</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {retrievedContext.map((result, i) => (
                            <div
                              key={result.id}
                              className="p-4 rounded-lg bg-secondary/30 border border-border/50"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">#{i + 1}</Badge>
                                  <Badge variant="outline">{result.id}</Badge>
                                </div>
                                <Badge 
                                  variant={result.score > 0.7 ? 'default' : 'secondary'}
                                >
                                  Similarity: {(result.score * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground">
                                {result.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="code" className="mt-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">Implementation Code</CardTitle>
                          <CardDescription>
                            Use this code to implement RAG with Binario
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={copyCode}>
                          {copied ? (
                            <Check className="w-4 h-4 mr-2" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="p-4 rounded-lg bg-secondary/50 border border-border overflow-x-auto text-sm">
                        <code className="text-foreground">{`import { Binario, CloudflareEmbeddings, createMemory } from 'binario';

// Setup embeddings provider
const embeddings = new CloudflareEmbeddings({
  binding: env.AI,
  model: 'bge-base-en-v1.5',
});

// Create vector memory for RAG
const memory = createMemory({
  type: 'vector',
  options: {
    topK: 3,
    embeddings,
  },
});

// Index documents
for (const doc of documents) {
  await memory.add({ role: 'system', content: doc });
}

// Query with RAG
async function queryWithRAG(question: string) {
  // Retrieve relevant context
  const results = await memory.search(question);
  const context = results.map(r => r.content).join('\\n');
  
  // Generate answer with context
  const response = await client.chat([
    { role: 'system', content: \`Answer based on context:\\n\${context}\` },
    { role: 'user', content: question },
  ]);
  
  return response.content;
}`}</code>
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}