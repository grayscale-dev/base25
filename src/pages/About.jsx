import { Link } from 'react-router-dom';
import { ArrowRight, Users, Target, Zap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function About() {
  const values = [
    {
      icon: Users,
      title: 'Community First',
      description: 'We believe in building products with our users, not just for them. Every feature starts with your feedback.'
    },
    {
      icon: Target,
      title: 'Focused Development',
      description: 'We prioritize what matters most. Our roadmap is transparent and driven by real user needs.'
    },
    {
      icon: Zap,
      title: 'Move Fast',
      description: 'Ship quickly, iterate constantly. We deliver updates and improvements at lightning speed.'
    },
    {
      icon: Heart,
      title: 'Support Excellence',
      description: 'Real people, real help. Our team is here to ensure your success every step of the way.'
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
            <Link to={createPageUrl('About')} className="text-sm font-medium text-slate-900">About</Link>
            <Link to={createPageUrl('Pricing')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</Link>
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
            Built for teams who listen
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Nexus is a customer feedback and collaboration platform designed to help teams build better products by staying connected with their users.
          </p>
        </div>
      </section>

      {/* Values Grid */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            What we stand for
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div key={index} className="bg-white p-8 rounded-2xl border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-slate-600">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Story</h2>
          <div className="prose prose-lg text-slate-600">
            <p className="mb-4">
              At Grayscale Development, we needed a tool to collect customer feedback, provide support, document our products, and share our roadmap transparently. We looked at existing solutions but found them either too complicated, too expensive, or missing key features.
            </p>
            <p className="mb-4">
              So we built Nexus—a platform that brings together everything teams need to stay connected with their customers. We use it ourselves every day, and we're proud to maintain and continuously improve it.
            </p>
            <p>
              What started as an internal tool has grown into a product we're excited to share with other teams who value customer collaboration and transparent communication.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join teams who are building better products with Nexus
          </p>
          <Link to={createPageUrl('Workspaces')}>
            <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
              Start Free
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