import { useNavigate } from 'react-router-dom';
import { Bot, Database, Image, Mic, Languages, BarChart3, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PlaygroundFeatureCardsProps {
  onSendPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const capabilities = [
  {
    icon: Bot,
    title: 'Chat & VibeCoding',
    description: 'Crea apps completas con AI',
    prompt: 'Crea un blog moderno con dark mode, header con navegación y cards para los posts',
    color: 'from-primary/20 to-primary/5',
  },
  {
    icon: Database,
    title: 'RAG Studio',
    description: 'Embeddings y búsqueda semántica',
    href: '/rag-example',
    color: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    icon: Image,
    title: 'App de Imágenes',
    description: 'Crea una app con Flux AI',
    prompt: 'Crea una app que permita generar imágenes a partir de texto usando la API de Cloudflare Flux. Incluye un input para el prompt, un botón de generar, y una galería de imágenes generadas',
    color: 'from-violet-500/20 to-violet-500/5',
  },
  {
    icon: Mic,
    title: 'App de Audio',
    description: 'Crea una app con Whisper',
    prompt: 'Crea una app que permita grabar o subir audio y transcribirlo usando Whisper de Cloudflare. Incluye un botón de grabar, visualización de audio, y el texto transcrito',
    color: 'from-amber-500/20 to-amber-500/5',
  },
  {
    icon: Languages,
    title: 'App de Traducción',
    description: 'Crea una app con M2M100',
    prompt: 'Crea una app de traducción de texto que use el modelo M2M100 de Cloudflare. Incluye selector de idioma origen/destino, input de texto y resultado de traducción',
    color: 'from-sky-500/20 to-sky-500/5',
  },
  {
    icon: BarChart3,
    title: 'Model Benchmark',
    description: 'Compara modelos side-by-side',
    href: '/benchmark',
    color: 'from-rose-500/20 to-rose-500/5',
  },
  {
    icon: Wand2,
    title: 'AI Tools',
    description: 'Prueba las capacidades AI',
    href: '/ai-tools',
    color: 'from-primary/10 to-accent/10',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
};

export function PlaygroundFeatureCards({ onSendPrompt, disabled }: PlaygroundFeatureCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-2.5 w-full max-w-[340px]">
      {capabilities.map((cap, i) => (
        <motion.button
          key={cap.title}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={i}
          disabled={disabled}
          onClick={() => {
            if (cap.href) {
              navigate(cap.href);
            } else if (cap.prompt) {
              onSendPrompt(cap.prompt);
            }
          }}
          className={`group text-left p-3 rounded-xl bg-gradient-to-br ${cap.color} border border-border/30 hover:border-primary/40 transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <cap.icon className="w-5 h-5 text-foreground/70 group-hover:text-primary transition-colors mb-1.5" />
          <p className="text-xs font-semibold text-foreground leading-tight">{cap.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{cap.description}</p>
        </motion.button>
      ))}
    </div>
  );
}
