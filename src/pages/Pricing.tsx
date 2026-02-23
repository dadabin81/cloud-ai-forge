import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap, Building, Sparkles, Bell, X, Cpu, Image, Mic, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Experiment with Cloudflare Workers AI free tier',
    icon: Zap,
    features: [
      '10,000 neurons/day (~500-1,000 tokens text)',
      '~2,000 AI images/day (Flux Schnell)',
      '~243 min audio transcription/day',
      '~9.3M embedding tokens/day',
      'RAG with Vectorize (5M vectors)',
      'D1 database (5GB)',
      'Community support',
    ],
    cta: 'Get Started',
    highlighted: false,
    available: true,
  },
  {
    name: 'Pro',
    price: '$5',
    period: '/month',
    description: 'Millions of tokens for production apps',
    icon: Sparkles,
    features: [
      '~450K neurons/month ($5 at $0.011/1K)',
      '~3M+ output tokens (Qwen3-30B)',
      'All 17+ Cloudflare AI models',
      'Priority rate limits (100 req/min)',
      'Response caching (KV)',
      '90-day usage history',
      'Smart model routing',
    ],
    cta: 'Coming Soon',
    highlighted: true,
    available: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Dedicated infrastructure for teams',
    icon: Building,
    features: [
      'Unlimited neurons',
      'All models including 70B+',
      'Custom rate limits',
      'SLA guarantee (99.9%)',
      'Dedicated support',
      'Custom integrations',
      'On-premise option',
    ],
    cta: 'Contact Us',
    highlighted: false,
    available: false,
  },
];

const freeServices = [
  { icon: Cpu, name: 'Text AI', detail: '~500-1,000 tokens/day', sub: 'IBM Granite Micro (most efficient)' },
  { icon: Image, name: 'Image Gen', detail: '~2,000 images/day', sub: 'Flux Schnell - completely free' },
  { icon: Mic, name: 'Audio', detail: '~243 min/day', sub: 'Whisper transcription' },
  { icon: Database, name: 'Embeddings', detail: '~9.3M tokens/day', sub: 'BGE-M3 for RAG/search' },
];

const modelPricing = [
  { model: 'IBM Granite Micro', output: '~985', efficiency: '★★★★★', tier: 'free' },
  { model: 'Mistral 7B', output: '~578', efficiency: '★★★★', tier: 'free' },
  { model: 'Llama 3.2 1B', output: '~548', efficiency: '★★★★', tier: 'free' },
  { model: 'GPT-OSS 20B', output: '~367', efficiency: '★★★', tier: 'free' },
  { model: 'Qwen3-30B-A3B', output: '~328', efficiency: '★★★', tier: 'pro' },
  { model: 'Llama 3.1 8B Fast', output: '~287', efficiency: '★★★', tier: 'free' },
  { model: 'GPT-OSS 120B', output: '~147', efficiency: '★★', tier: 'pro' },
  { model: 'Llama 3.3 70B', output: '~49', efficiency: '★', tier: 'pro' },
];

const faqs = [
  {
    q: 'What are neurons?',
    a: 'Neurons are Cloudflare\'s billing unit for Workers AI. Free tier gives 10,000 neurons/day. Different models consume neurons at different rates — smaller models are much more efficient.',
  },
  {
    q: 'How many tokens can I get for free?',
    a: 'It depends on the model. IBM Granite Micro gives ~985 output tokens/day, while Llama 3.3 70B only gives ~49. We default to the most efficient model to maximize your free usage.',
  },
  {
    q: 'Are images and audio really free?',
    a: 'Yes! Flux Schnell image generation (~2,000/day) and Whisper audio transcription (~243 min/day) are included in Cloudflare\'s free tier at no additional cost.',
  },
  {
    q: 'What does the Pro plan include?',
    a: 'At $5/month you get ~450K neurons, which translates to ~3M+ tokens with efficient models like Qwen3-30B. That\'s extremely competitive compared to OpenAI or Anthropic.',
  },
];

export default function Pricing() {
  const [email, setEmail] = useState('');
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ email });
      
      if (error) {
        if (error.code === '23505') {
          toast.info('You\'re already on the waitlist!');
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      } else {
        toast.success('Thanks! We\'ll notify you when paid plans are available.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setEmail('');
    setShowWaitlist(false);
    setIsSubmitting(false);
  };

  const handlePlanClick = (plan: typeof plans[0]) => {
    if (plan.available) {
      window.location.href = '/auth';
    } else {
      setShowWaitlist(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Waitlist Modal */}
      {showWaitlist && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Join the Waitlist</h3>
              </div>
              <button onClick={() => setShowWaitlist(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Paid plans are coming soon! Enter your email and we'll notify you when they're available.
            </p>
            <form onSubmit={handleWaitlistSubmit} className="space-y-3">
              <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Joining...' : 'Notify Me'}
              </Button>
            </form>
          </div>
        </div>
      )}
      
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
              <span className="text-sm text-amber-400 font-medium">100% Cloudflare Workers AI — No external APIs</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Transparent <span className="gradient-text">Pricing</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powered exclusively by Cloudflare's infrastructure. Images, audio & embeddings are practically free.
            </p>
          </div>

          {/* Free Services Highlight */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {freeServices.map((s) => (
              <div key={s.name} className="p-4 rounded-xl border border-border bg-card text-center">
                <s.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-primary text-lg font-bold">{s.detail}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative ${plan.highlighted ? 'border-primary shadow-lg shadow-primary/10' : ''} ${!plan.available ? 'opacity-80' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Best Value
                    </span>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <plan.icon className="w-5 h-5 text-primary" />
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'} onClick={() => handlePlanClick(plan)}>
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Model Cost Table */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-center mb-2">Free Tier Token Reality</h2>
            <p className="text-center text-muted-foreground mb-8">Output tokens per day with 10,000 free neurons</p>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium">Model</th>
                    <th className="px-6 py-4 text-center text-sm font-medium">Output Tokens/Day</th>
                    <th className="px-6 py-4 text-center text-sm font-medium">Efficiency</th>
                    <th className="px-6 py-4 text-center text-sm font-medium">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {modelPricing.map((m) => (
                    <tr key={m.model}>
                      <td className="px-6 py-4 text-sm font-medium">{m.model}</td>
                      <td className="px-6 py-4 text-sm text-center font-mono">{m.output}</td>
                      <td className="px-6 py-4 text-sm text-center">{m.efficiency}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.tier === 'free' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                          {m.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQs */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {faqs.map((faq, i) => (
                <div key={i} className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 text-center">
            <div className="p-8 rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent">
              <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                Start building AI-powered applications with Binario. Free images, audio, and embeddings included.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg" onClick={() => window.location.href = '/auth'}>Start for Free</Button>
                <Button variant="outline" size="lg" onClick={() => setShowWaitlist(true)}>Join Pro Waitlist</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
