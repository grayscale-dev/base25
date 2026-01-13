import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Target, Zap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import BetaAccessModal from '@/components/common/BetaAccessModal';
import PublicHeader from '@/components/common/PublicHeader';
import PublicFooter from '@/components/common/PublicFooter';

export default function About() {
  const [showBetaModal, setShowBetaModal] = useState(false);

  useEffect(() => {
    document.title = 'base25 - About';
  }, []);

  const values = [
    {
      icon: Users,
      title: 'Community First',
      description: 'We believe in building products with our users, not just for them. Every feature starts with your feedback.',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      icon: Target,
      title: 'Focused Development',
      description: 'We prioritize what matters most. Our roadmap is transparent and driven by real user needs.',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      icon: Zap,
      title: 'Move Fast',
      description: 'Ship quickly, iterate constantly. We deliver updates and improvements at lightning speed.',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      icon: Heart,
      title: 'Support Excellence',
      description: 'Real people, real help. Our team is here to ensure your success every step of the way.',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>
      <PublicHeader currentPage="About" onRequestAccess={() => setShowBetaModal(true)} />

      <main className="bg-[#F8FAFC] relative z-0">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
        </div>
        <div className="relative z-10">
        {/* Hero Section */}
        <section className="px-6 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 relative">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              Built for teams who{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                listen
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              base25 is a customer feedback and collaboration platform designed to help teams build better products by staying connected with their users.
            </p>
          </div>
        </section>

        {/* Values Grid */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
              What we stand for
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div key={index} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${value.iconBg}`}>
                      <Icon className={`h-6 w-6 ${value.iconColor}`} />
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
                So we built base25—a platform that brings together everything teams need to stay connected with their customers. We use it ourselves every day, and we're proud to maintain and continuously improve it.
              </p>
              <p>
                What started as an internal tool has grown into a product we're excited to share with other teams who value customer collaboration and transparent communication.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-900/80 text-white p-10 relative overflow-hidden shadow-xl">
            <div className="absolute -top-12 -right-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-3xl font-semibold">Ready to get started?</h2>
                <p className="text-slate-200 mt-2 max-w-2xl">
                  Join teams who are building better products with base25.
                </p>
              </div>
              <Button
                className="bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => setShowBetaModal(true)}
              >
                Request access
              </Button>
            </div>
          </div>
        </section>
        </div>
      </main>

      <PublicFooter />

      <BetaAccessModal open={showBetaModal} onOpenChange={setShowBetaModal} />
    </div>
  );
}
