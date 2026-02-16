import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap, Building, Sparkles, Bell, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for getting started and experimenting',
    icon: Zap,
    features: [
      '1,000 requests/month',
      'Cloudflare Workers AI models',
      'Basic rate limiting (10 req/min)',
      'Community support',
      '7-day usage history',
    ],
    cta: 'Get Started',
    highlighted: false,
    available: true,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For developers building production applications',
    icon: Sparkles,
    features: [
      '50,000 requests/month',
      'Access to all models',
      'Higher rate limits (100 req/min)',
      'Priority support',
      '90-day usage history',
      'Response caching',
      'Custom model routing',
    ],
    cta: 'Coming Soon',
    highlighted: true,
    available: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For teams with advanced requirements',
    icon: Building,
    features: [
      'Unlimited requests',
      'Dedicated infrastructure',
      'Custom rate limits',
      'SLA guarantee (99.9%)',
      'Priority queue access',
      'Custom integrations',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    highlighted: false,
    available: false,
  },
];

const faqs = [
  {
    q: 'What happens if I exceed my request limit?',
    a: 'Your requests will be rate-limited until the next billing cycle. You can upgrade your plan at any time to increase your limits.',
  },
  {
    q: 'When will Pro and Enterprise plans be available?',
    a: 'We\'re currently in beta. Sign up for our waitlist and we\'ll notify you when paid plans become available.',
  },
  {
    q: 'What models are included in the free tier?',
    a: 'Free plans include access to Cloudflare Workers AI models like Llama 3.1 8B, Mistral 7B, and more. These run on Cloudflare\'s free tier (10,000 neurons/day).',
  },
  {
    q: 'Can I use my own API keys for other providers?',
    a: 'Currently, the hosted API uses Cloudflare Workers AI. For other providers (OpenAI, Anthropic, Google), you can self-host the SDK with your own API keys.',
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
              <button 
                onClick={() => setShowWaitlist(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Paid plans are coming soon! Enter your email and we'll notify you when they're available.
            </p>
            <form onSubmit={handleWaitlistSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
              <span className="text-sm text-amber-400 font-medium">Beta - Free tier available</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Simple, Transparent <span className="gradient-text">Pricing</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free with Cloudflare's AI models. Paid plans coming soon.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative ${
                  plan.highlighted 
                    ? 'border-primary shadow-lg shadow-primary/10' 
                    : ''
                } ${!plan.available ? 'opacity-80' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Coming Soon
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
                  <Button 
                    className="w-full" 
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => handlePlanClick(plan)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-medium">Free</th>
                    <th className="px-6 py-4 text-center text-sm font-medium bg-primary/5">Pro</th>
                    <th className="px-6 py-4 text-center text-sm font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-6 py-4 text-sm">Monthly Requests</td>
                    <td className="px-6 py-4 text-sm text-center">1,000</td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">50,000</td>
                    <td className="px-6 py-4 text-sm text-center">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">Rate Limit</td>
                    <td className="px-6 py-4 text-sm text-center">10/min</td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">100/min</td>
                    <td className="px-6 py-4 text-sm text-center">Custom</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">Models Access</td>
                    <td className="px-6 py-4 text-sm text-center">Basic</td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">All</td>
                    <td className="px-6 py-4 text-sm text-center">All + Custom</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">Agent Framework</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">Streaming</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">Support</td>
                    <td className="px-6 py-4 text-sm text-center">Community</td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">Priority</td>
                    <td className="px-6 py-4 text-sm text-center">Dedicated</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm">SLA</td>
                    <td className="px-6 py-4 text-sm text-center text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-sm text-center bg-primary/5">99%</td>
                    <td className="px-6 py-4 text-sm text-center">99.9%</td>
                  </tr>
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
                Join thousands of developers building AI-powered applications with Binario.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg">Start for Free</Button>
                <Button variant="outline" size="lg">Contact Sales</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
