import Link from '@/components/common/AppLink';
import { MessageSquareText, Map, Sparkles, Workflow } from 'lucide-react';
import PublicPageLayout from '@/components/common/PublicPageLayout';
import { MarketingCtaBanner, MarketingHeroActions } from '@/components/common/PublicMarketingBlocks';
import { publicRouteAnchors, publicRoutes } from '@/lib/public-routes';

export default function Home() {
  const features = [
    {
      icon: MessageSquareText,
      title: 'Feedback Management',
      description: 'Collect, organize, and prioritize customer feedback in one place',
      to: publicRouteAnchors.feedbackManagement,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      icon: Map,
      title: 'Product Roadmap',
      description: 'Share your plans and keep users informed about what\'s coming',
      to: publicRouteAnchors.productRoadmap,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      icon: Sparkles,
      title: 'Changelog',
      description: 'Announce updates and keep your community engaged',
      to: publicRouteAnchors.changelog,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      icon: Workflow,
      title: 'Workflow Automation',
      description: 'Connect feedback, roadmap, and changelog in one shared workflow',
      to: publicRouteAnchors.workflowAutomation,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    }
  ];

  return (
    <PublicPageLayout currentPage="home">
        {/* Hero Section */}
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto text-center space-y-6 relative">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">
              Home
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              Your customer{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                feedback hub
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              base25 brings together feedback, roadmap, and changelog in one beautiful platform. 
              Build better products by staying connected with your users.
            </p>
            <MarketingHeroActions />
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
              Everything you need to stay connected with customers
            </h2>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Link
                    key={index}
                    to={feature.to}
                    className="block h-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${feature.iconBg}`}>
                      <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600">
                      {feature.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 pb-20">
          <MarketingCtaBanner
            title="Ready to get started?"
            description="Start building with feedback, roadmap, and changelog in one place."
            primaryTo={publicRoutes.workspaceHub}
            secondaryTo={publicRoutes.workspaceHub}
          />
        </section>
    </PublicPageLayout>
  );
}
