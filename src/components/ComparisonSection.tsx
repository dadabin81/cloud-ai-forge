import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  name: string;
  binario: boolean | 'partial';
  vercel: boolean | 'partial';
  langchain: boolean | 'partial';
}

const features: Feature[] = [
  { name: 'Multi-provider support', binario: true, vercel: true, langchain: true },
  { name: 'Native streaming', binario: true, vercel: true, langchain: 'partial' },
  { name: 'Edge runtime ready', binario: true, vercel: true, langchain: false },
  { name: 'React hooks', binario: true, vercel: true, langchain: false },
  { name: 'Built-in caching', binario: true, vercel: false, langchain: 'partial' },
  { name: 'Auto-retry with backoff', binario: true, vercel: false, langchain: 'partial' },
  { name: 'Tool calling', binario: true, vercel: true, langchain: true },
  { name: 'Structured output', binario: true, vercel: true, langchain: true },
  { name: 'Type-safe', binario: true, vercel: true, langchain: 'partial' },
  { name: 'Bundle size <5kb', binario: true, vercel: 'partial', langchain: false },
  { name: 'Zero dependencies', binario: true, vercel: false, langchain: false },
  { name: 'Cloudflare optimized', binario: true, vercel: false, langchain: false },
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
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How we
            <span className="gradient-text"> compare</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            NexusAI combines the best features from existing solutions while adding what's missing.
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
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
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
