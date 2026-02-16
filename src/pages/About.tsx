import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Shield, 
  Globe, 
  Users, 
  Target, 
  Heart,
  ArrowRight,
  Code,
  Rocket
} from 'lucide-react';

const values = [
  {
    icon: Zap,
    title: 'Developer First',
    description: 'Every feature is designed with developers in mind. Clean APIs, excellent TypeScript support, and comprehensive documentation.',
  },
  {
    icon: Shield,
    title: 'Reliability',
    description: 'Built on Cloudflare\'s global edge network, ensuring 99.9% uptime and ultra-low latency worldwide.',
  },
  {
    icon: Globe,
    title: 'Accessibility',
    description: 'We believe AI should be accessible to everyone. That\'s why we offer a generous free tier with no credit card required.',
  },
  {
    icon: Heart,
    title: 'Open Source',
    description: 'Our SDK is open source. We believe in transparency and community-driven development.',
  },
];

const stats = [
  { value: '4', label: 'AI Providers' },
  { value: '10K', label: 'Free Neurons/Day' },
  { value: '100%', label: 'TypeScript' },
  { value: 'MIT', label: 'License' },
];

const team = [
  { name: 'Core Team', role: 'Engineering', description: 'Building the future of AI development' },
  { name: 'Community', role: 'Contributors', description: 'Open source contributors worldwide' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center mb-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            About <span className="gradient-text">Binario</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            We're on a mission to democratize AI development. Binario makes it easy for developers 
            to build AI-powered applications without the complexity of managing multiple providers, 
            infrastructure, or breaking the bank.
          </p>
        </section>

        {/* Mission Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Target className="w-4 h-4" />
                Our Mission
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Making AI Accessible to Every Developer
              </h2>
              <p className="text-muted-foreground mb-6">
                We started Binario because we saw a gap in the market. Developers wanted to use AI 
                in their applications, but faced high costs, complex APIs, and vendor lock-in.
              </p>
              <p className="text-muted-foreground mb-6">
                Binario solves this by providing a unified SDK that works with multiple AI providers, 
                including free access to powerful models through Cloudflare Workers AI. No credit card 
                required, no hidden costs, just great AI APIs.
              </p>
              <Button asChild>
                <Link to="/docs">
                  Read Our Documentation
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-3xl" />
              <Card className="relative border-primary/20">
                <CardContent className="p-8">
                  <Code className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Built by Developers, for Developers</h3>
                  <p className="text-muted-foreground">
                    Our team has built AI applications at scale. We understand the challenges 
                    and have designed Binario to solve them elegantly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <Card key={i} className="text-center">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Values Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Values</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              These principles guide everything we do at Binario
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, i) => (
              <Card key={i} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-6 flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Team Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The Team</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Binario is built by a passionate team of developers and AI enthusiasts
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {team.map((member, i) => (
              <Card key={i}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-sm text-primary mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-8 md:p-12 text-center">
              <Rocket className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to Build with Binario?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Start building AI-powered applications with Binario.
                Get started for free, no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="hero" asChild>
                  <Link to="/auth">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/contact">Contact Us</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
