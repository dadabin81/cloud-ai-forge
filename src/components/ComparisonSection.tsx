import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  name: string;
  binario: boolean | 'partial';
  vercel: boolean | 'partial';
  langchain: boolean | 'partial';
  pydantic: boolean | 'partial';
}

const features: Feature[] = [
  { name: 'Free AI tier (10K neurons/day)', binario: true, vercel: false, langchain: false, pydantic: false },
  { name: 'Pydantic-style schemas', binario: true, vercel: 'partial', langchain: 'partial', pydantic: true },
  { name: 'Agent framework', binario: true, vercel: false, langchain: true, pydantic: true },
  { name: 'Multi-provider support', binario: true, vercel: true, langchain: true, pydantic: true },
  { name: 'Native streaming', binario: true, vercel: true, langchain: 'partial', pydantic: 'partial' },
  { name: 'Edge runtime ready', binario: true, vercel: true, langchain: false, pydantic: false },
  { name: 'React hooks', binario: true, vercel: true, langchain: false, pydantic: false },
  { name: 'Built-in caching', binario: true, vercel: false, langchain: 'partial', pydantic: false },
  { name: 'Auto-retry with backoff', binario: true, vercel: false, langchain: 'partial', pydantic: false },
  { name: 'Tool calling', binario: true, vercel: true, langchain: true, pydantic: true },
  { name: 'Type-safe', binario: true, vercel: true, langchain: 'partial', pydantic: true },
  { name: 'Bundle size <5kb', binario: true, vercel: 'partial', langchain: false, pydantic: false },
  { name: 'Minimal dependencies (only zod)', binario: true, vercel: false, langchain: false, pydantic: false },
  { name: 'Cloudflare Workers optimized', binario: true, vercel: false, langchain: false, pydantic: false },
  { name: 'Dependency injection', binario: true, vercel: false, langchain: 'partial', pydantic: true },
  { name: 'Observability hooks', binario: true, vercel: 'partial', langchain: true, pydantic: true },
  { name: 'Usage tracking & budgets', binario: true, vercel: false, langchain: false, pydantic: false },
  { name: 'Free fallback models', binario: true, vercel: false, langchain: false, pydantic: false },
  { name: 'Worker template generator', binario: true, vercel: false, langchain: false, pydantic: false },
];

function FeatureStatus({ status }: { status: boolean | 'partial' }) {
  if (status === true) {
    return <Check className="w-5 h-5 text-emerald-400" />;
  }
  if (status === 'partial') {
    return <Minus className="w-5 h-5 text-amber-400" />;
  }
  return <X className="w-5 h-5 text-red-400/60" />;
}

export function ComparisonSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How we
            <span className="gradient-text"> compare</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Binario combines the best of Vercel AI SDK, LangChain, and Pydantic AI — with Cloudflare's free AI tier.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 font-semibold text-foreground">Feature</th>
                <th className="text-center py-4 px-4 font-semibold">
                  <span className="gradient-text">Binario</span>
                </th>
                <th className="text-center py-4 px-4 font-semibold text-muted-foreground">Vercel AI</th>
                <th className="text-center py-4 px-4 font-semibold text-muted-foreground">LangChain</th>
                <th className="text-center py-4 px-4 font-semibold text-muted-foreground">Pydantic AI</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr
                  key={feature.name}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    'hover:bg-secondary/30'
                  )}
                >
                  <td className="py-4 px-4 text-sm text-muted-foreground">{feature.name}</td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <FeatureStatus status={feature.binario} />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <FeatureStatus status={feature.vercel} />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <FeatureStatus status={feature.langchain} />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <FeatureStatus status={feature.pydantic} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Full support</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-amber-400" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400/60" />
            <span>Not supported</span>
          </div>
        </div>
      </div>
    </section>
  );
}
