import { ProviderBadge } from '@/components/ProviderBadge';
import { StatsCard } from '@/components/StatsCard';

const providers = [
  { name: 'Cloudflare', color: '#f38020', highlight: true },
  { name: 'OpenAI', color: '#10a37f' },
  { name: 'Anthropic', color: '#d4a574' },
  { name: 'Google AI', color: '#4285f4' },
  { name: 'Mistral', color: '#ff7000' },
  { name: 'Cohere', color: '#39594d' },
  { name: 'Azure OpenAI', color: '#0078d4' },
  { name: 'Groq', color: '#f55036' },
];

const stats = [
  { value: '10K', label: 'Free Neurons/Day' },
  { value: '7+', label: 'Providers' },
  { value: '<2kb', label: 'Gzipped Size' },
  { value: '100%', label: 'TypeScript' },
];

export function ProvidersSection() {
  return (
    <section id="providers" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat) => (
            <StatsCard key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>

        {/* Providers */}
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            One SDK,
            <span className="gradient-text"> every provider</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Switch providers with a single line change. Start free with Cloudflare, scale with any provider.
          </p>
          <p className="text-sm text-emerald-400 font-medium mb-12">
            ✨ Cloudflare Workers AI: 10,000 free neurons/day
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {providers.map((provider) => (
              <ProviderBadge
                key={provider.name}
                name={provider.name}
                color={provider.color}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
