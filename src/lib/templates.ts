// Professional Template Catalog for VibeCoding Playground
import type { ProjectFile } from '@/lib/projectGenerator';

export type TemplateCategory = 'landing' | 'dashboard' | 'ecommerce' | 'blog' | 'api' | 'portfolio' | 'saas' | 'admin';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  stack: string[];
  files: Record<string, ProjectFile>;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: 'landing', label: 'Landing Page', icon: '🚀' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { id: 'blog', label: 'Blog', icon: '📝' },
  { id: 'api', label: 'API + Frontend', icon: '⚡' },
  { id: 'portfolio', label: 'Portfolio', icon: '🎨' },
  { id: 'saas', label: 'SaaS', icon: '💼' },
  { id: 'admin', label: 'Admin Panel', icon: '🛠️' },
];

const pf = (code: string, language: string): ProjectFile => ({ code, language });

const htmlEntry = (title: string, cssPath = 'src/styles/globals.css', extras = '') =>
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>${extras}
  <link rel="stylesheet" href="${cssPath}" />
</head>
<body class="bg-gray-950 text-white">
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel" data-type="module">
    // Components are concatenated by the preview engine
  </script>
</body>
</html>`;

const globalsCss = `@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
.animate-fade-up { animation: fadeUp 0.6s ease-out forwards; }
.animate-float { animation: float 3s ease-in-out infinite; }
`;

// Keep templates but they are now used internally by AI suggestion, not a manual gallery
export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'saas-landing', name: 'SaaS Landing Page', category: 'landing', icon: '🚀',
    description: 'Landing page moderna con hero, features, pricing y CTA.',
    stack: ['React', 'Tailwind CSS', 'Animations'],
    files: {
      'index.html': pf(htmlEntry('SaaS Landing'), 'html'),
      'src/styles/globals.css': pf(globalsCss, 'css'),
      'src/components/Header.jsx': pf(`function Header() {
  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
      <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">SaaSify</span>
      <div className="flex gap-6 text-sm text-gray-400">
        <a href="#features" className="hover:text-white transition">Features</a>
        <a href="#pricing" className="hover:text-white transition">Pricing</a>
        <button className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-500 transition">Get Started</button>
      </div>
    </nav>
  );
}`, 'jsx'),
      'src/components/Hero.jsx': pf(`function Hero() {
  return (
    <section className="text-center py-24 px-8 animate-fade-up">
      <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent">Build Faster.<br/>Ship Smarter.</h1>
      <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">The modern platform for building apps at the edge.</p>
      <div className="flex gap-4 justify-center">
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-medium transition">Start Free</button>
        <button className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-3 rounded-xl font-medium transition">Live Demo</button>
      </div>
    </section>
  );
}`, 'jsx'),
      'src/components/Features.jsx': pf(`function Features() {
  const features = [
    { icon: '⚡', title: 'Lightning Fast', desc: 'Built for speed with edge computing.' },
    { icon: '🔒', title: 'Secure', desc: 'Enterprise-grade security.' },
    { icon: '📈', title: 'Auto Scaling', desc: 'Scales with your traffic.' },
    { icon: '🌍', title: 'Global CDN', desc: '300+ edge locations.' },
  ];
  return (
    <section id="features" className="py-20 px-8 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition animate-fade-up" style={{animationDelay: i*0.1+'s'}}>
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`, 'jsx'),
      'src/components/Pricing.jsx': pf(`function Pricing() {
  const plans = [
    { name: 'Starter', price: '$0', features: ['1 Project', '1K req/day', 'Community support'] },
    { name: 'Pro', price: '$29', features: ['Unlimited projects', '100K req/day', 'Priority support'], popular: true },
    { name: 'Enterprise', price: 'Custom', features: ['Unlimited everything', 'SLA', 'Dedicated support'] },
  ];
  return (
    <section id="pricing" className="py-20 px-8 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p, i) => (
          <div key={i} className={\`rounded-2xl p-6 border \${p.popular ? 'border-blue-500 bg-blue-950/30 scale-105' : 'border-gray-800 bg-gray-900'}\`}>
            {p.popular && <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full">Popular</span>}
            <h3 className="text-xl font-bold mt-3">{p.name}</h3>
            <p className="text-3xl font-bold my-4">{p.price}<span className="text-sm text-gray-400">/mo</span></p>
            <ul className="space-y-2 mb-6">{p.features.map((f,j) => <li key={j} className="text-gray-400 text-sm">✓ {f}</li>)}</ul>
            <button className={\`w-full py-2.5 rounded-xl font-medium transition \${p.popular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}\`}>Choose Plan</button>
          </div>
        ))}
      </div>
    </section>
  );
}`, 'jsx'),
      'src/App.jsx': pf(`function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <footer className="text-center py-8 text-gray-500 text-sm border-t border-gray-800">© 2026 SaaSify. All rights reserved.</footer>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`, 'jsx'),
    },
  },
  {
    id: 'dashboard-analytics', name: 'Dashboard Analytics', category: 'dashboard', icon: '📊',
    description: 'Panel de analytics con gráficos, stats y sidebar.',
    stack: ['React', 'Chart.js', 'Tailwind CSS'],
    files: {
      'index.html': pf(htmlEntry('Analytics Dashboard', 'src/styles/globals.css', '\n  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'), 'html'),
      'src/styles/globals.css': pf(globalsCss, 'css'),
      'src/components/Sidebar.jsx': pf(`function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
      <h2 className="text-lg font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Dashboard</h2>
      {['Overview','Analytics','Users','Settings'].map(item => (
        <button key={item} className="text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition">{item}</button>
      ))}
    </aside>
  );
}`, 'jsx'),
      'src/components/StatCard.jsx': pf(`function StatCard({ label, value, change, icon }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex justify-between items-start">
        <div><p className="text-gray-400 text-sm">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={\`text-sm mt-2 \${change > 0 ? 'text-green-400' : 'text-red-400'}\`}>
        {change > 0 ? '↑' : '↓'} {Math.abs(change)}% vs last month
      </p>
    </div>
  );
}`, 'jsx'),
      'src/components/RevenueChart.jsx': pf(`function RevenueChart() {
  const chartRef = React.useRef(null);
  const chartInstance = React.useRef(null);
  React.useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();
    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [
          { label: 'Revenue', data: [3000,4500,4200,5800,6200,7100,8400], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 },
          { label: 'Users', data: [1200,1900,2100,2800,3200,3900,4500], borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } }, y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } } } }
    });
  }, []);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="font-semibold mb-4">Revenue & Users</h3>
      <canvas ref={chartRef} height="100"></canvas>
    </div>
  );
}`, 'jsx'),
      'src/App.jsx': pf(`function App() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Revenue" value="$8,400" change={18.2} icon="💰" />
          <StatCard label="Users" value="4,521" change={12.5} icon="👥" />
          <StatCard label="Conversion" value="3.2%" change={-2.1} icon="📈" />
          <StatCard label="Avg. Session" value="4m 32s" change={8.7} icon="⏱️" />
        </div>
        <RevenueChart />
      </main>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`, 'jsx'),
    },
  },
  {
    id: 'portfolio-minimal', name: 'Portfolio Minimalista', category: 'portfolio', icon: '🎨',
    description: 'Portfolio personal con galería de proyectos.',
    stack: ['React', 'Tailwind CSS'],
    files: {
      'index.html': pf(htmlEntry('Portfolio').replace('bg-gray-950', 'bg-neutral-950'), 'html'),
      'src/styles/globals.css': pf(globalsCss, 'css'),
      'src/components/About.jsx': pf(`function About() {
  return (
    <section className="mb-20">
      <p className="text-sm text-neutral-500 uppercase tracking-widest mb-4">Developer & Designer</p>
      <h1 className="text-5xl font-bold mb-6">Hi, I'm Alex.</h1>
      <p className="text-neutral-400 text-lg max-w-xl">I build beautiful, performant web applications.</p>
    </section>
  );
}`, 'jsx'),
      'src/components/ProjectGrid.jsx': pf(`function ProjectGrid() {
  const projects = [
    { title: 'E-commerce Platform', tech: 'React + Node.js', emoji: '🛍️' },
    { title: 'AI Chat Assistant', tech: 'Python + OpenAI', emoji: '🤖' },
    { title: 'Mobile Fitness App', tech: 'React Native', emoji: '💪' },
    { title: 'Data Dashboard', tech: 'D3.js + Express', emoji: '📊' },
  ];
  return (
    <section className="mb-20">
      <h2 className="text-sm text-neutral-500 uppercase tracking-widest mb-8">Selected Work</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {projects.map((p, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-600 transition cursor-pointer group">
            <span className="text-4xl mb-4 block">{p.emoji}</span>
            <h3 className="font-semibold text-lg group-hover:text-blue-400 transition">{p.title}</h3>
            <p className="text-neutral-500 text-sm mt-1">{p.tech}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`, 'jsx'),
      'src/App.jsx': pf(`function App() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <About />
      <ProjectGrid />
      <section>
        <h2 className="text-sm text-neutral-500 uppercase tracking-widest mb-4">Contact</h2>
        <a href="mailto:hello@alex.dev" className="text-blue-400 hover:text-blue-300 transition">hello@alex.dev</a>
      </section>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`, 'jsx'),
    },
  },
  {
    id: 'chat-app', name: 'Chat Application', category: 'saas', icon: '💬',
    description: 'App de chat en tiempo real con UI moderna.',
    stack: ['React', 'Tailwind CSS', 'WebSocket'],
    files: {
      'index.html': pf(htmlEntry('Chat'), 'html'),
      'src/styles/globals.css': pf(globalsCss, 'css'),
      'src/components/ContactList.jsx': pf(`function ContactList() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800"><h2 className="font-bold">💬 Messages</h2></div>
      <div className="flex-1 overflow-auto">
        {['Alice','Bob','Carol'].map(c => (
          <button key={c} className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 border-b border-gray-800/50">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm">{c[0]}</span>
            <div><p className="text-sm font-medium">{c}</p><p className="text-xs text-gray-500">Last message...</p></div>
          </button>
        ))}
      </div>
    </aside>
  );
}`, 'jsx'),
      'src/components/ChatWindow.jsx': pf(`function ChatWindow() {
  const [messages, setMessages] = React.useState([
    { id: 1, user: 'System', text: 'Welcome! 🎉', time: '10:00', type: 'system' },
    { id: 2, user: 'Alice', text: 'Hey!', time: '10:01', type: 'other' },
  ]);
  const [input, setInput] = React.useState('');
  const bottomRef = React.useRef(null);
  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: Date.now(), user: 'You', text: input, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), type: 'self' }]);
    setInput('');
    setTimeout(() => {
      setMessages(p => [...p, { id: Date.now()+1, user: 'Alice', text: 'That sounds great! 👍', time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), type: 'other' }]);
    }, 1000);
  };
  return (
    <main className="flex-1 flex flex-col">
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm">A</span>
        <div><p className="font-medium text-sm">Alice</p><p className="text-xs text-green-400">Online</p></div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={\`flex \${m.type==='self'?'justify-end':m.type==='system'?'justify-center':'justify-start'}\`}>
            {m.type==='system'
              ? <span className="text-xs text-gray-500 bg-gray-900 px-3 py-1 rounded-full">{m.text}</span>
              : <div className={\`max-w-xs px-4 py-2 rounded-2xl \${m.type==='self'?'bg-blue-600 text-white rounded-br-md':'bg-gray-800 text-gray-100 rounded-bl-md'}\`}>
                  <p className="text-sm">{m.text}</p><p className="text-xs opacity-60 mt-1">{m.time}</p>
                </div>
            }
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div className="p-4 border-t border-gray-800 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} placeholder="Type a message..." className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
        <button onClick={send} className="bg-blue-600 hover:bg-blue-500 px-5 rounded-xl text-sm font-medium">Send</button>
      </div>
    </main>
  );
}`, 'jsx'),
      'src/App.jsx': pf(`function App() {
  return (
    <div className="flex h-screen">
      <ContactList />
      <ChatWindow />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`, 'jsx'),
    },
  },
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
  return TEMPLATES.filter(t => t.category === category);
}

/**
 * Suggest the best template based on a user description.
 * Used internally by the AI to pre-load a relevant starting point.
 */
export function suggestTemplate(description: string): ProjectTemplate | null {
  const lower = description.toLowerCase();
  const keywords: Record<string, string[]> = {
    'saas-landing': ['landing', 'saas', 'startup', 'producto', 'product', 'marketing'],
    'dashboard-analytics': ['dashboard', 'analytics', 'panel', 'estadísticas', 'stats', 'métricas', 'metrics', 'admin'],
    'portfolio-minimal': ['portfolio', 'portafolio', 'personal', 'cv', 'resume'],
    'chat-app': ['chat', 'messaging', 'mensajería', 'real-time', 'realtime'],
  };

  let bestMatch: { id: string; score: number } = { id: '', score: 0 };
  for (const [templateId, words] of Object.entries(keywords)) {
    const score = words.filter(w => lower.includes(w)).length;
    if (score > bestMatch.score) {
      bestMatch = { id: templateId, score };
    }
  }

  if (bestMatch.score > 0) {
    return getTemplateById(bestMatch.id) || null;
  }
  return null;
}
