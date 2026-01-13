import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import BetaAccessModal from '@/components/common/BetaAccessModal';
import PublicHeader from '@/components/common/PublicHeader';
import PublicFooter from '@/components/common/PublicFooter';

export default function Pricing() {
  const [showBetaModal, setShowBetaModal] = useState(false);

  useEffect(() => {
    document.title = 'base25 - Pricing';
    window.scrollTo(0, 0);
  }, []);

  const services = ['Feedback', 'Roadmap', 'Changelog', 'Docs', 'Support'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <PublicHeader currentPage="Pricing" onRequestAccess={() => setShowBetaModal(true)} />

      <main className="relative">
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              Invite-only beta • Trial starts after access is granted
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
              Only pay for the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                services you need
              </span>
              .
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              Every board starts with 50 interactions per day included. We only charge for
              write actions after that, and only for the services you turn on.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setShowBetaModal(true)}>
                Request access
              </Button>
              <Link to={createPageUrl('Workspaces')} className="self-center text-sm text-slate-500 hover:text-slate-900">
                Have access? Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 text-slate-900">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <h2 className="text-2xl font-semibold">Core pricing</h2>
              </div>
              <p className="text-slate-600 mt-3">
                After the 7-day trial, each enabled service is $5 per month.
              </p>
              <div className="mt-6 grid gap-4">
                {services.map((service) => (
                  <div
                    key={service}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <span className="font-medium">{service}</span>
                    <span className="text-sm text-slate-500">$5 / month</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 text-slate-900">
                <Zap className="h-6 w-6 text-cyan-600" />
                <h2 className="text-2xl font-semibold">Usage pricing</h2>
              </div>
              <p className="text-slate-600 mt-3">
                We only count authenticated write actions (new data). Reads are always free.
              </p>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 px-5 py-4">
                  <p className="text-sm text-slate-500">Included every day</p>
                  <p className="text-3xl font-semibold text-slate-900">50 interactions</p>
                  <p className="text-sm text-slate-500">Per board, resets daily</p>
                </div>
                <div className="rounded-2xl border border-slate-200 px-5 py-4">
                  <p className="text-sm text-slate-500">Overage</p>
                  <p className="text-3xl font-semibold text-slate-900">$0.002</p>
                  <p className="text-sm text-slate-500">Per interaction</p>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Counted interactions</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    Feedback posts, comments, votes
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    Roadmap items, votes, and comments
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    Changelog entries and reactions
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    Docs pages, edits, and comments
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    Support tickets and replies
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="max-w-6xl mx-auto rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-900/80 text-white p-10 relative overflow-hidden">
          <div className="absolute -top-16 -right-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
              <div>
                <h2 className="text-3xl font-semibold">Invite-only beta</h2>
                <p className="text-slate-200 mt-2 max-w-2xl">
                  We onboard a limited number of teams each week to keep support tight.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="bg-white text-slate-900 hover:bg-slate-100"
                  onClick={() => setShowBetaModal(true)}
                >
                  Request access
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      <BetaAccessModal open={showBetaModal} onOpenChange={setShowBetaModal} />
    </div>
  );
}
