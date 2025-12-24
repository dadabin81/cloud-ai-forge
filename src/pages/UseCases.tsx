import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  FileText, 
  Code2, 
  Brain, 
  Globe, 
  Sparkles,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const API_BASE_URL = 'https://binario-api.databin81.workers.dev';

interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tags: string[];
  code: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const useCases: UseCase[] = [
  {
    id: 'chatbot',
    title: 'Customer Support Chatbot',
    description: 'Build an intelligent chatbot that can answer customer questions, handle inquiries, and provide 24/7 support.',
    icon: MessageSquare,
    tags: ['Chat', 'Support', 'Streaming'],
    difficulty: 'beginner',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Customer support chatbot
async function handleCustomerQuery(userMessage: string, history: Message[]) {
  const response = await ai.chat([
    { 
      role: 'system', 
      content: 'You are a helpful customer support agent for our company. ' +
               'Be friendly, professional, and always try to solve the customer\\'s issue.'
    },
    ...history,
    { role: 'user', content: userMessage }
  ], {
    model: '@cf/meta/llama-3.1-8b-instruct',
    stream: true, // Enable streaming for real-time responses
  });

  return response;
}`,
  },
  {
    id: 'content-generation',
    title: 'Content Generation',
    description: 'Generate blog posts, marketing copy, product descriptions, and other content automatically.',
    icon: FileText,
    tags: ['Writing', 'Marketing', 'SEO'],
    difficulty: 'beginner',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Generate a blog post
async function generateBlogPost(topic: string, tone: string) {
  const response = await ai.chat([
    { 
      role: 'system', 
      content: \`You are an expert content writer. Write engaging, 
                 SEO-optimized content with a \${tone} tone.\`
    },
    { 
      role: 'user', 
      content: \`Write a comprehensive blog post about: \${topic}
                 Include an introduction, 3-5 main sections, and a conclusion.\`
    }
  ], {
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });

  return response.content;
}`,
  },
  {
    id: 'code-assistant',
    title: 'Code Assistant',
    description: 'Help developers write, review, and debug code with AI-powered assistance.',
    icon: Code2,
    tags: ['Developer', 'Coding', 'Review'],
    difficulty: 'intermediate',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Code review assistant
async function reviewCode(code: string, language: string) {
  const response = await ai.chat([
    { 
      role: 'system', 
      content: \`You are an expert \${language} developer. Review code for:
                 1. Bugs and potential issues
                 2. Performance improvements
                 3. Best practices and code style
                 4. Security vulnerabilities
                 Provide specific, actionable feedback.\`
    },
    { 
      role: 'user', 
      content: \`Review this \${language} code:\n\n\${code}\`
    }
  ], {
    model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  });

  return response.content;
}`,
  },
  {
    id: 'data-analysis',
    title: 'Data Analysis & Insights',
    description: 'Analyze data, generate insights, and create summaries from complex datasets.',
    icon: Brain,
    tags: ['Analytics', 'Business', 'Reports'],
    difficulty: 'intermediate',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Analyze sales data
async function analyzeSalesData(data: SalesRecord[]) {
  const summary = JSON.stringify(data.slice(0, 100)); // Sample data
  
  const response = await ai.chat([
    { 
      role: 'system', 
      content: 'You are a data analyst. Analyze the provided data and extract ' +
               'key insights, trends, and actionable recommendations.'
    },
    { 
      role: 'user', 
      content: \`Analyze this sales data and provide insights:\n\n\${summary}\`
    }
  ], {
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });

  return response.content;
}`,
  },
  {
    id: 'translation',
    title: 'Multi-language Translation',
    description: 'Translate content between languages while preserving context and tone.',
    icon: Globe,
    tags: ['Translation', 'i18n', 'Global'],
    difficulty: 'beginner',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Translate text with context preservation
async function translateText(
  text: string, 
  targetLanguage: string, 
  context?: string
) {
  const response = await ai.chat([
    { 
      role: 'system', 
      content: \`You are a professional translator. Translate to \${targetLanguage} 
                 while preserving the original tone, context, and meaning.
                 \${context ? 'Context: ' + context : ''}\`
    },
    { role: 'user', content: text }
  ], {
    model: '@cf/meta/llama-3.1-8b-instruct',
  });

  return response.content;
}`,
  },
  {
    id: 'ai-agent',
    title: 'AI Agent with Tools',
    description: 'Build autonomous AI agents that can use tools and take actions on behalf of users.',
    icon: Sparkles,
    tags: ['Agent', 'Tools', 'Automation'],
    difficulty: 'advanced',
    code: `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: process.env.BINARIO_API_KEY,
});

// Define tools for the agent
const tools = [
  {
    name: 'search_database',
    description: 'Search the product database',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email to a customer',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['to', 'subject', 'body']
    }
  }
];

// Run agent with tools
async function runAgent(task: string) {
  const response = await ai.agentRun({
    task,
    tools,
    onToolCall: async (toolName, args) => {
      // Execute the tool and return results
      if (toolName === 'search_database') {
        return await searchDatabase(args.query, args.limit);
      }
      if (toolName === 'send_email') {
        return await sendEmail(args.to, args.subject, args.body);
      }
    }
  });

  return response;
}`,
  },
];

const difficultyColors = {
  beginner: 'bg-green-500/10 text-green-500 border-green-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  advanced: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function UseCases() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    toast.success('Code copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              Use Cases
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              What can you build with <span className="gradient-text">Binario</span>?
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore real-world examples and copy-paste code to get started quickly.
              Each example includes production-ready code you can use immediately.
            </p>
          </div>

          {/* Use Cases Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {useCases.map((useCase) => (
              <Card key={useCase.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <useCase.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{useCase.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={difficultyColors[useCase.difficulty]}
                          >
                            {useCase.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-3">
                    {useCase.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {useCase.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="p-4 bg-[#1a1a2e] rounded-lg font-mono text-xs overflow-x-auto text-gray-300 max-h-[200px]">
                      {useCase.code}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => copyCode(useCase.code, useCase.id)}
                    >
                      {copied === useCase.id ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-12">
                <h2 className="text-2xl font-bold mb-4">
                  Ready to build something amazing?
                </h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  Get started with Binario today. Free tier includes 100 requests/day 
                  and access to all Cloudflare AI models.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Button asChild size="lg">
                    <Link to="/auth">
                      Get Started Free
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/playground">
                      Try the Playground
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
