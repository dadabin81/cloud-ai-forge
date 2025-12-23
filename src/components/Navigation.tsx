import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Github, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import binarioLogo from '@/assets/binario-logo.png';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={binarioLogo} alt="Binario" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-xl tracking-tight">
              <span className="gradient-text">Binario</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection('features')} 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('providers')} 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Providers
            </button>
            <Link 
              to="/docs" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Docs
            </Link>
            <button 
              onClick={() => scrollToSection('examples')} 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Examples
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => window.open('https://github.com/binario-ai/binario', '_blank')}
            >
              <Github className="w-4 h-4" />
              GitHub
            </Button>
            <Button 
              variant="hero" 
              size="sm"
              onClick={() => navigate('/docs')}
            >
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
          <button 
            onClick={() => scrollToSection('features')} 
            className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Features
          </button>
          <button 
            onClick={() => scrollToSection('providers')} 
            className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Providers
          </button>
          <Link 
            to="/docs" 
            className="block text-muted-foreground hover:text-foreground transition-colors py-2"
            onClick={() => setIsMenuOpen(false)}
          >
            Docs
          </Link>
          <button 
            onClick={() => scrollToSection('examples')} 
            className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Examples
          </button>
          <div className="pt-4 flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open('https://github.com/binario-ai/binario', '_blank')}
            >
              <Github className="w-4 h-4" />
              GitHub
            </Button>
            <Button 
              variant="hero" 
              className="w-full"
              onClick={() => {
                setIsMenuOpen(false);
                navigate('/docs');
              }}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
