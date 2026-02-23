import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">
              Last updated: February 16, 2026
            </p>
          </div>

          <Card>
            <CardContent className="prose prose-invert max-w-none p-8">
              <div className="space-y-8 text-foreground">
                <section>
                  <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    By accessing or using Binario's services, SDK, API, or website (collectively, the "Services"), 
                    you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
                    you may not use the Services.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">2. Description of Services</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Binario provides a software development kit (SDK) and API that enables developers to integrate 
                    AI capabilities into their applications. Our Services include access to various AI models 
                    through a unified interface, including free access to Cloudflare Workers AI models and 
                    premium access to third-party providers.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="leading-relaxed">
                      To use certain features of the Services, you must register for an account. You agree to:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Provide accurate and complete information</li>
                      <li>Maintain the security of your account credentials</li>
                      <li>Promptly notify us of any unauthorized use of your account</li>
                      <li>Accept responsibility for all activities that occur under your account</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">4. API Keys and Authentication</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    API keys are confidential and should be kept secure. You are responsible for all API calls 
                    made using your API keys. Do not share your API keys or commit them to public repositories. 
                    We reserve the right to revoke API keys that are compromised or being misused.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="leading-relaxed">You agree not to use the Services to:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Violate any applicable laws or regulations</li>
                      <li>Generate harmful, illegal, or malicious content</li>
                      <li>Attempt to bypass rate limits or security measures</li>
                      <li>Interfere with or disrupt the Services or servers</li>
                      <li>Reverse engineer, decompile, or disassemble the Services</li>
                      <li>Use automated systems to abuse the Services</li>
                      <li>Resell or redistribute the Services without authorization</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">6. Rate Limits and Usage</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    The Services are subject to rate limits based on your plan. Free tier users are limited to 
                    10 requests per minute and 100 requests per day. Exceeding these limits may result in 
                    temporary suspension of access. Paid plans have higher limits as specified in your plan details.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">7. Fees and Payment</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Certain features of the Services require payment. Fees are billed in advance on a monthly 
                    or annual basis. All fees are non-refundable except as required by law. We reserve the right 
                    to change our pricing with 30 days' notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    The Services, including the SDK, documentation, and all related materials, are owned by 
                    Binario and are protected by intellectual property laws. You retain ownership of any content 
                    you create using the Services, including AI-generated outputs based on your prompts.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">9. Third-Party Services</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Our Services are powered by Cloudflare Workers AI infrastructure. 
                    Your use of AI capabilities through our Services is also subject to Cloudflare's 
                    terms of service and acceptable use policies. We are not responsible for the content 
                    generated by AI models.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                    EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, 
                    ERROR-FREE, OR SECURE. AI-GENERATED CONTENT MAY CONTAIN ERRORS OR INACCURACIES.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, BINARIO SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                    INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE 
                    SERVICES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">12. Indemnification</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You agree to indemnify and hold harmless Binario and its officers, directors, employees, 
                    and agents from any claims, damages, or expenses arising from your use of the Services 
                    or violation of these Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">13. Termination</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may terminate or suspend your access to the Services at any time, with or without cause, 
                    with or without notice. Upon termination, your right to use the Services will immediately cease.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to modify these Terms at any time. We will notify you of material changes 
                    by posting the updated Terms on our website. Your continued use of the Services after such 
                    changes constitutes acceptance of the new Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">15. Governing Law</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    These Terms shall be governed by and construed in accordance with the laws of the State of 
                    California, without regard to its conflict of law provisions.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">16. Contact Information</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have any questions about these Terms, please contact us at:
                  </p>
                  <div className="mt-4 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm">
                      <strong>Email:</strong> legal@binario.dev<br />
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
