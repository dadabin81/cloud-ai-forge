import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  MessageSquare, 
  FileText, 
  Github,
  Twitter,
  Send,
  Loader2,
  CheckCircle,
  HelpCircle,
  Building,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be less than 200 characters'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message must be less than 2000 characters'),
});

const contactOptions = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Get help from our support team',
    contact: 'support@binario.dev',
    action: 'mailto:support@binario.dev',
  },
  {
    icon: Github,
    title: 'GitHub',
    description: 'Report bugs and request features',
    contact: 'github.com/binario-ai',
    action: 'https://github.com/binario-ai/binario',
  },
  {
    icon: Twitter,
    title: 'Twitter',
    description: 'Follow us for updates',
    contact: '@BinarioAI',
    action: 'https://twitter.com/BinarioAI',
  },
];

const faqItems = [
  {
    question: 'How do I get started with Binario?',
    answer: 'Sign up for a free account, grab your API key, and follow our quick start guide. You\'ll be making AI requests in under 5 minutes.',
  },
  {
    question: 'Is Binario really free?',
    answer: 'Yes! Our free tier includes unlimited access to Cloudflare Workers AI models. Premium providers like OpenAI require a paid plan.',
  },
  {
    question: 'Do you offer enterprise plans?',
    answer: 'Yes, we offer custom enterprise plans with dedicated support, SLAs, and volume discounts. Contact our sales team for more information.',
  },
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate with zod
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success('Message sent successfully!');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="pt-24 pb-20 px-4 flex items-center justify-center">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for reaching out. We'll get back to you within 24 hours.
              </p>
              <Button onClick={() => setIsSubmitted(false)} variant="outline">
                Send Another Message
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Get in <span className="gradient-text">Touch</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions about Binario? We'd love to hear from you. 
            Send us a message and we'll respond as soon as possible.
          </p>
        </section>

        <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Send us a Message
                  </CardTitle>
                  <CardDescription>
                    Fill out the form below and we'll get back to you within 24 hours.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Your name"
                          value={formData.name}
                          onChange={handleChange}
                          disabled={isSubmitting}
                        />
                        {errors.name && (
                          <p className="text-sm text-destructive">{errors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange}
                          disabled={isSubmitting}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        value={formData.subject}
                        onChange={handleChange}
                        disabled={isSubmitting}
                      />
                      {errors.subject && (
                        <p className="text-sm text-destructive">{errors.subject}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us more about your question or feedback..."
                        rows={5}
                        value={formData.message}
                        onChange={handleChange}
                        disabled={isSubmitting}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive">{errors.message}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Other Ways to Reach Us</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactOptions.map((option, i) => (
                    <a
                      key={i}
                      href={option.action}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <option.icon className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{option.title}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                        <div className="text-xs text-primary mt-1">{option.contact}</div>
                      </div>
                    </a>
                  ))}
                </CardContent>
              </Card>

              {/* Enterprise CTA */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6">
                  <Building className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">Enterprise Solutions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Need custom integrations, dedicated support, or volume pricing?
                  </p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href="mailto:enterprise@binario.dev">
                      <Zap className="w-4 h-4 mr-2" />
                      Contact Sales
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-primary" />
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {faqItems.map((item, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">{item.question}</h3>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
