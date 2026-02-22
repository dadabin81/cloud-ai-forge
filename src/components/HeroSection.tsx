import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/CodeBlock';
import { ArrowRight, Terminal, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const heroCode = `import { Binario } from 'binario';
import { useChat, BinarioProvider } from 'binario/react';

// 1 line to start — no config, no infra
const ai = new Binario('bsk_live_xxx');

// SaaS React hooks (NEW in v0.2.0)
function App() {
  return (
    <BinarioProvider client={ai}>
      <ChatApp />
    </BinarioProvider>
  );
}

function ChatApp() {
  const { messages, send, isLoading } = useChat(ai);

  return (
    <div>
      {messages.map(m => <p key={m.role}>{m.content}</p>)}
      <button onClick={() => send('Explain quantum computing')}>
        {isLoading ? 'Thinking...' : 'Ask AI'}
      </button>
    </div>
  );
}`;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
};

const stats = [
  { value: '7', label: 'AI providers' },
  { value: '10', label: 'React hooks' },
  { value: '151', label: 'tests passing' },
];

export function HeroSection() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install binario zod');
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToExamples = () => {
    const element = document.getElementById('examples');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side */}
          <div className="space-y-8">
            {/* Badges */}
            <motion.div
              className="flex flex-wrap items-center gap-3"
              variants={fadeUp} initial="hidden" animate="visible" custom={0}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-sm text-primary font-medium">v0.2.0 — Free Llama 3 via Cloudflare</span>
              </div>
              <a
                href="https://www.npmjs.com/package/binario"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium hover:bg-destructive/15 transition-colors"
              >
                📦 Live on NPM
              </a>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
              variants={fadeUp} initial="hidden" animate="visible" custom={1}
            >
              The AI SDK that
              <br />
              <span className="gradient-text">doesn't hold back</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-lg text-muted-foreground max-w-xl"
              variants={fadeUp} initial="hidden" animate="visible" custom={2}
            >
              <strong className="text-foreground">Free Llama 3</strong> via Cloudflare Workers AI.
              Pydantic-style schemas. Agent framework with tools.
              Multi-provider streaming. Built for developers who demand more.
            </motion.p>

            {/* Stats row */}
            <motion.div
              className="flex flex-wrap gap-8"
              variants={fadeUp} initial="hidden" animate="visible" custom={3}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-4"
              variants={fadeUp} initial="hidden" animate="visible" custom={4}
            >
              <Button variant="hero" size="xl" className="gap-2" onClick={() => navigate('/docs')}>
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="xl" className="gap-2" onClick={scrollToExamples}>
                <Terminal className="w-5 h-5" />
                View Examples
              </Button>
            </motion.div>

            {/* Install command */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/30 border border-border/50 font-mono text-sm">
                <span className="text-muted-foreground">$</span>
                <span className="text-foreground">npm install binario zod</span>
                <button
                  onClick={copyCommand}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Copy install command"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right side - Code example */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
            <CodeBlock
              code={heroCode}
              language="typescript"
              filename="app.tsx"
              className="relative"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
