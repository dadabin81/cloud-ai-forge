import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import binarioLogo from '@/assets/binario-logo.png';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={binarioLogo} alt="Binario" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-xl tracking-tight">
              <span className="gradient-text">Binario</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Features
            </a>
            <a href="#providers" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Providers
            </a>
            <a href="#docs" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Docs
            </a>
            <a href="#examples" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Examples
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2">
              <Github className="w-4 h-4" />
              GitHub
            </Button>
            <Button variant="hero" size="sm">
              Get Started
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/50',
          'transition-all duration-300 ease-in-out',
          isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        )}
      >
        <div className="px-4 py-4 space-y-4">
          <a href="#features" className="block text-muted-foreground hover:text-foreground transition-colors py-2">
            Features
          </a>
          <a href="#providers" className="block text-muted-foreground hover:text-foreground transition-colors py-2">
            Providers
          </a>
          <a href="#docs" className="block text-muted-foreground hover:text-foreground transition-colors py-2">
            Docs
          </a>
          <a href="#examples" className="block text-muted-foreground hover:text-foreground transition-colors py-2">
            Examples
          </a>
          <div className="pt-4 flex flex-col gap-3">
            <Button variant="outline" className="w-full gap-2">
              <Github className="w-4 h-4" />
              GitHub
            </Button>
            <Button variant="hero" className="w-full">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
