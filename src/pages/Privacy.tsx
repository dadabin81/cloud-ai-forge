import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: December 24, 2024
            </p>
          </div>

          <Card>
            <CardContent className="prose prose-invert max-w-none p-8">
              <div className="space-y-8 text-foreground">
                <section>
                  <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Binario ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                    explains how we collect, use, disclose, and safeguard your information when you use our 
                    SDK, API services, and website (collectively, the "Services").
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2">2.1 Account Information</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        When you create an account, we collect your email address, password (hashed), and 
                        any other information you choose to provide.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">2.2 Usage Data</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We collect information about how you use our Services, including API requests, 
                        token usage, timestamps, and the models you access. This data is used to provide 
                        the service and improve our offerings.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">2.3 API Request Content</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We process the content of your API requests (prompts and responses) to provide 
                        the AI services. We do not store the content of your requests beyond what is 
                        necessary for rate limiting and abuse prevention.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>To provide, maintain, and improve our Services</li>
                    <li>To process transactions and send related information</li>
                    <li>To send technical notices, updates, and support messages</li>
                    <li>To detect, prevent, and address technical issues or abuse</li>
                    <li>To comply with legal obligations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We do not sell your personal information. We may share your information in the following circumstances:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li><strong>Service Providers:</strong> We use Cloudflare for infrastructure and may share data as necessary to provide services.</li>
                    <li><strong>AI Providers:</strong> When you use premium providers (OpenAI, Anthropic, etc.), your requests are processed by those providers subject to their privacy policies.</li>
                    <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We implement appropriate technical and organizational security measures to protect your 
                    data, including encryption in transit (TLS) and at rest, secure password hashing (SHA-256), 
                    and regular security audits.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We retain your account information for as long as your account is active. Usage data 
                    is retained for up to 90 days for analytics and billing purposes. You may request 
                    deletion of your data at any time by contacting us.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Depending on your location, you may have the following rights:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Delete your data</li>
                    <li>Export your data in a portable format</li>
                    <li>Opt-out of certain data processing</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Our services are provided globally via Cloudflare's edge network. Your data may be 
                    processed in various locations worldwide. We ensure appropriate safeguards are in 
                    place for international data transfers.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Our Services are not intended for children under 13 years of age. We do not knowingly 
                    collect personal information from children under 13.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of any changes 
                    by posting the new Privacy Policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have any questions about this Privacy Policy, please contact us at:
                  </p>
                  <div className="mt-4 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm">
                      <strong>Email:</strong> privacy@binario.dev<br />
                      <strong>Address:</strong> Binario AI, Inc.
                    </p>
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
