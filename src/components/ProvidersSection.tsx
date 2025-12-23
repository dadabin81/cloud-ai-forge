import { ProviderBadge } from '@/components/ProviderBadge';
import { StatsCard } from '@/components/StatsCard';

const providers = [
  { name: 'OpenAI', color: '#10a37f' },
  { name: 'Anthropic', color: '#d4a574' },
  { name: 'Google AI', color: '#4285f4' },
  { name: 'Mistral', color: '#ff7000' },
  { name: 'Cohere', color: '#39594d' },
  { name: 'Azure OpenAI', color: '#0078d4' },
  { name: 'AWS Bedrock', color: '#ff9900' },
  { name: 'Groq', color: '#f55036' },
];

const stats = [
  { value: '8+', label: 'Supported Providers' },
  { value: '50+', label: 'AI Models' },
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
          <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
            Switch providers with a single line change. No rewriting code, no learning new APIs.
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
