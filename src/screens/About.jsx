import { Users, Target, Zap, Heart } from 'lucide-react';
import PublicPageLayout from '@/components/common/PublicPageLayout';
import { MarketingCtaBanner, MarketingHeroActions } from '@/components/common/PublicMarketingBlocks';
import { publicRoutes } from '@/lib/public-routes';

export default function About() {
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
      title: 'Customer Partnership',
      description: 'Real collaboration with product teams focused on building what users need most.',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    }
  ];

  return (
    <PublicPageLayout currentPage="about">
        {/* Hero Section */}
        <section className="px-6 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 relative">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">
              About
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              Built for teams who{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                listen
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              base25 is a customer feedback and collaboration platform designed to help teams build better products by staying connected with their users.
            </p>
            <MarketingHeroActions />
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
                At Grayscale Development, we needed a tool to collect customer feedback, share our roadmap transparently, and publish clear release updates. We looked at existing solutions but found them either too complicated, too expensive, or missing key features.
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
          <MarketingCtaBanner
            title="Ready to get started?"
            description="Join teams who are building better products with base25."
            primaryTo={publicRoutes.workspaceHub}
            secondaryTo={publicRoutes.workspaceHub}
          />
        </section>
    </PublicPageLayout>
  );
}
