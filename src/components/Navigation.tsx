import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Github, LogOut, User, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import binarioLogo from '@/assets/binario-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';

const productLinks = [
  { name: 'Platform', href: '/#features', description: 'Cloudflare-native AI platform' },
  { name: 'Models', href: '/#providers', description: '17+ AI models included' },
  { name: 'Pricing', href: '/pricing', description: 'Free tier & paid plans' },
  { name: 'Use Cases', href: '/use-cases', description: 'Real-world applications' },
];

const buildLinks = [
  { name: 'Playground IDE', href: '/playground', description: 'Chat, code & deploy in-browser' },
  { name: 'RAG Studio', href: '/rag-example', description: 'Embeddings, search & Q&A' },
  { name: 'Model Benchmark', href: '/benchmark', description: 'Compare AI models side-by-side' },
  { name: 'Templates', href: '/templates', description: 'Community project templates' },
];

const learnLinks = [
  { name: 'Documentation', href: '/docs', description: 'Guides & API reference' },
  { name: 'About', href: '/about', description: 'The team behind Binario' },
  { name: 'Contact', href: '/contact', description: 'Get in touch' },
];

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img src={binarioLogo} alt="Binario" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-xl tracking-tight">
              <span className="gradient-text">Binario</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground text-sm">
                    Product
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[320px] gap-1 p-3">
                      {productLinks.map((link) => (
                        <li key={link.name}>
                          <Link
                            to={link.href}
                            className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 focus:bg-accent/10"
                          >
                            <div className="text-sm font-medium text-foreground">{link.name}</div>
                            <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground text-sm">
                    Build
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[320px] gap-1 p-3">
                      {buildLinks.map((link) => (
                        <li key={link.name}>
                          <Link
                            to={link.href}
                            className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 focus:bg-accent/10"
                          >
                            <div className="text-sm font-medium text-foreground">{link.name}</div>
                            <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-muted-foreground hover:text-foreground text-sm">
                    Learn
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[320px] gap-1 p-3">
                      {learnLinks.map((link) => (
                        <li key={link.name}>
                          <Link
                            to={link.href}
                            className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 focus:bg-accent/10"
                          >
                            <div className="text-sm font-medium text-foreground">{link.name}</div>
                            <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link
                    to="/docs"
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium px-3 py-2"
                  >
                    Docs
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => window.open('https://github.com/dadabin81/cloud-ai-forge', '_blank')}
            >
              <Github className="w-4 h-4" />
              GitHub
            </Button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    {user?.email?.split('@')[0]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/projects')}>
                    Projects
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  Login
                </Button>
                <Button variant="hero" size="sm" onClick={() => navigate('/auth')}>
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'lg:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/50',
          'transition-all duration-300 ease-in-out overflow-hidden',
          isMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 py-4 space-y-1 overflow-y-auto max-h-[70vh]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">Product</p>
          {productLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="block px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-1">Build</p>
          {buildLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="block px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-1">Learn</p>
          {learnLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="block px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}

          <div className="pt-4 flex flex-col gap-3 border-t border-border/50 mt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open('https://github.com/dadabin81/cloud-ai-forge', '_blank')}
            >
              <Github className="w-4 h-4" />
              GitHub
            </Button>

            {isAuthenticated ? (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setIsMenuOpen(false); navigate('/dashboard'); }}
                >
                  Dashboard
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                variant="hero"
                className="w-full"
                onClick={() => { setIsMenuOpen(false); navigate('/auth'); }}
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
