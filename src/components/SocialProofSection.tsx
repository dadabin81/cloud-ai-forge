import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "Binario replaced 3 different libraries in our stack. The Cloudflare-native approach is a game changer.",
    author: "Alex R.",
    role: "CTO, NeuralApps",
    stars: 5,
  },
  {
    quote: "The agent framework with tool calling just works. We went from prototype to production in 2 days.",
    author: "Maria S.",
    role: "Lead Engineer, DataFlow",
    stars: 5,
  },
  {
    quote: "Free Llama 3 on the edge? Plus Pydantic-style schemas? This is what I've been waiting for.",
    author: "James L.",
    role: "Indie Developer",
    stars: 5,
  },
];

const logos = [
  'Cloudflare', 'Vercel', 'OpenAI', 'Google', 'Anthropic', 'Meta',
];

export function SocialProofSection() {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

      <div className="relative max-w-7xl mx-auto">
        {/* Trusted by logos */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8 font-medium">
            Built for teams using
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4">
            {logos.map((logo) => (
              <span
                key={logo}
                className="text-sm font-semibold text-muted-foreground/40 tracking-wider uppercase"
              >
                {logo}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 relative group hover:border-primary/30 transition-colors"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.15, duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <Quote className="w-8 h-8 text-primary/20 mb-4" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/90 mb-4 leading-relaxed">"{t.quote}"</p>
              <div>
                <p className="text-sm font-medium text-foreground">{t.author}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
