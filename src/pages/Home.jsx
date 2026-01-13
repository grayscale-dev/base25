import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, Map, HeadphonesIcon, BookOpen, Sparkles, Workflow, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import BetaAccessModal from '@/components/common/BetaAccessModal';
import PublicHeader from '@/components/common/PublicHeader';
import PublicFooter from '@/components/common/PublicFooter';

export default function Home() {
  useEffect(() => {
    document.title = 'base25 - Home';
  }, []);

  const [submitted, setSubmitted] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false);

  const features = [
    {
      icon: MessageSquareText,
      title: 'Feedback Management',
      description: 'Collect, organize, and prioritize customer feedback in one place',
      anchor: 'feedback-management',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      icon: Map,
      title: 'Product Roadmap',
      description: 'Share your plans and keep users informed about what\'s coming',
      anchor: 'product-roadmap',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      icon: Sparkles,
      title: 'Changelog',
      description: 'Announce updates and keep your community engaged',
      anchor: 'changelog',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      icon: BookOpen,
      title: 'Documentation',
      description: 'Build comprehensive docs with questions and comments',
      anchor: 'documentation',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      icon: HeadphonesIcon,
      title: 'Support Threads',
      description: 'Provide stellar support with organized conversation threads',
      anchor: 'support-threads',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    },
    {
      icon: Workflow,
      title: 'Workflow Automation',
      description: 'Connect everything - feedback, roadmaps, docs, and support',
      anchor: 'workflow-automation',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>
      <PublicHeader currentPage="Home" onRequestAccess={() => setShowBetaModal(true)} />

      <main className="relative bg-[#F8FAFC] z-0">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
        </div>
        <div className="relative z-10">
        {/* Hero Section */}
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto text-center space-y-6 relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Now in Private Beta
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              Your customer{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                feedback hub
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              base25 brings together feedback, roadmaps, documentation, and support in one beautiful platform. 
              Build better products by staying connected with your users.
            </p>
            <div className="flex flex-col items-center gap-3 pt-2">
              <Button
                size="lg"
                className="bg-slate-900 hover:bg-slate-800"
                onClick={() => setShowBetaModal(true)}
              >
                Request access
              </Button>
              <Link
                to={createPageUrl('Workspaces')}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Already have access? Login
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
              Everything you need to stay connected with customers
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Link
                    key={index}
                    to={`${createPageUrl('Features')}#${feature.anchor}`}
                    className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all block"
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

        {/* Waitlist Section */}
        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-900/80 text-white p-10 relative overflow-hidden shadow-xl">
            <div className="absolute -top-12 -right-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-3xl font-semibold">Ready to join the beta?</h2>
                <p className="text-slate-200 mt-2 max-w-2xl">
                  Get early access to base25 and help shape the future of customer feedback.
                </p>
              </div>
              {submitted ? (
                <div className="bg-white/95 border border-white/60 rounded-2xl px-6 py-4 text-slate-900 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">You're on the list!</p>
                      <p className="text-sm text-slate-600">We’ll follow up soon.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  className="bg-white text-slate-900 hover:bg-slate-100"
                  onClick={() => setShowBetaModal(true)}
                >
                  Request access
                </Button>
              )}
            </div>
          </div>
        </section>
        </div>
      </main>

      <BetaAccessModal
        open={showBetaModal}
        onOpenChange={setShowBetaModal}
        onSubmitted={() => setSubmitted(true)}
      />

      <PublicFooter />
    </div>
  );
}
