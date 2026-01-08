import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 3 boards',
        'Unlimited feedback',
        'Basic roadmap',
        'Community support',
        'Public documentation'
      ],
      cta: 'Get Started',
      highlighted: false
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'For growing teams that need more',
      features: [
        'Unlimited boards',
        'Advanced roadmap features',
        'Custom branding',
        'Priority support',
        'Advanced analytics',
        'API access',
        'Team collaboration'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For organizations with specific needs',
      features: [
        'Everything in Pro',
        'SSO & advanced security',
        'Dedicated account manager',
        'Custom integrations',
        'SLA guarantee',
        'Training & onboarding',
        'White-label options'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ee36fb2c36c191b58c83e/678f5e1e6_create-a-svg-like-these-except-it-is-rock-on-symbo.png" 
              alt="Nexus" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-slate-900">Nexus</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to={createPageUrl('About')} className="text-sm font-medium text-slate-600 hover:text-slate-900">About</Link>
            <Link to={createPageUrl('Pricing')} className="text-sm font-medium text-slate-900">Pricing</Link>
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Workspaces')}>
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to={createPageUrl('Workspaces')}>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Choose the plan that fits your team. All plans include unlimited users.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-2xl scale-105'
                    : 'bg-white border-2 border-slate-200'
                }`}
              >
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                  {plan.description}
                </p>
                
                <div className="mb-6">
                  <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={plan.highlighted ? 'text-slate-300' : 'text-slate-500'}>
                      {plan.period}
                    </span>
                  )}
                </div>

                <Link to={createPageUrl('Workspaces')}>
                  <Button
                    className={`w-full mb-8 ${
                      plan.highlighted
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>

                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 ${
                        plan.highlighted ? 'text-green-400' : 'text-green-600'
                      }`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-slate-200' : 'text-slate-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-slate-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-slate-600">
                Yes, the Pro plan comes with a 14-day free trial. No credit card required.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-slate-600">
                We accept all major credit cards, PayPal, and can arrange invoicing for Enterprise customers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">
            Ready to transform your feedback process?
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Start with our free plan, no credit card required
          </p>
          <Link to={createPageUrl('Workspaces')}>
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ee36fb2c36c191b58c83e/678f5e1e6_create-a-svg-like-these-except-it-is-rock-on-symbo.png" 
              alt="Nexus" 
              className="h-6 w-6 object-contain"
            />
            <span className="font-semibold text-slate-900">nexus</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 Nexus. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}