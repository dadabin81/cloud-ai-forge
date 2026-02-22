import { Github } from 'lucide-react';
import binarioLogo from '@/assets/binario-logo.png';

const links = {
  product: [
  { name: 'Features', href: '/#features' },
  { name: 'Providers', href: '/#providers' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Use Cases', href: '/use-cases' }],

  resources: [
  { name: 'Documentation', href: '/docs' },
  { name: 'Playground', href: '/playground' },
  { name: 'Examples', href: '/#examples' }],

  company: [
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' }]

};

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src={binarioLogo} alt="Binario" className="w-9 h-9 rounded-lg" />
              <span className="font-bold text-xl">
                <span className="gradient-text">Binario</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              The most powerful AI SDK for building next-generation applications.
              Open source and production ready.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/dadabin81/cloud-ai-forge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub">

                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://www.npmjs.com/package/binario"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 hover:text-red-300 transition-colors">

                npm v0.2.0
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              {links.product.map((link) =>
              <li key={link.name}>
                  <a
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors">

                    {link.name}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Resources</h4>
            <ul className="space-y-3">
              {links.resources.map((link) =>
              <li key={link.name}>
                  <a
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors">

                    {link.name}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              {links.company.map((link) =>
              <li key={link.name}>
                  <a
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors">

                    {link.name}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 Binario. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">Made with ❤️ for developers everywhere 
     coded by @hichamanvers
          </p>
        </div>
      </div>
    </footer>);

}