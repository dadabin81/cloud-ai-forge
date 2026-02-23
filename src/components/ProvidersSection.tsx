import { StatsCard } from '@/components/StatsCard';
import { Cpu, Image, Mic, Database, Brain, HardDrive } from 'lucide-react';

const services = [
  { icon: Brain, name: 'Workers AI', detail: '17+ Models', sub: 'Text generation & reasoning' },
  { icon: Image, name: 'Flux Schnell', detail: '~2,000 img/day', sub: 'Free image generation' },
  { icon: Mic, name: 'Whisper', detail: '~243 min/day', sub: 'Free audio transcription' },
  { icon: Database, name: 'BGE-M3', detail: '~9.3M tokens/day', sub: 'Free embeddings for RAG' },
  { icon: Cpu, name: 'Vectorize', detail: '5M vectors', sub: 'Free vector search' },
  { icon: HardDrive, name: 'D1 + KV + R2', detail: '5GB+ storage', sub: 'Free database & cache' },
];

const stats = [
  { value: '10K', label: 'Free Neurons/Day' },
  { value: '17+', label: 'AI Models' },
  { value: '<2kb', label: 'Gzipped Size' },
  { value: '100%', label: 'Cloudflare Native' },
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

        {/* Services */}
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            One platform,
            <span className="gradient-text"> everything included</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Powered exclusively by Cloudflare's global edge network. Text, images, audio, embeddings — all in one SDK.
          </p>
          <p className="text-sm text-emerald-400 font-medium mb-12">
            ✨ Images, audio & embeddings are practically free
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {services.map((service) => (
              <div
                key={service.name}
                className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors text-center"
              >
                <service.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold">{service.name}</p>
                <p className="text-primary text-lg font-bold">{service.detail}</p>
                <p className="text-xs text-muted-foreground mt-1">{service.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
