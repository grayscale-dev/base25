import { Link } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function Pricing() {
  const services = ['Feedback', 'Roadmap', 'Changelog', 'Docs', 'Support'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <header className="relative border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="flex items-center gap-2">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ee36fb2c36c191b58c83e/678f5e1e6_create-a-svg-like-these-except-it-is-rock-on-symbo.png"
              alt="Nexus"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight">Nexus</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Workspaces')}>
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to={createPageUrl('Workspaces')}>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">
                Start free trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              Invite-only beta • Trial starts after access is granted
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
              Pay for what you enable, not what you read.
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              Every board starts with 50 interactions per day included. We only charge for
              write actions after that, and only for the services you turn on.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <a
                href="mailto:beta@nexus.app?subject=Nexus%20Beta%20Access"
                className="inline-flex"
              >
                <Button variant="outline" size="lg">
                  Request access
                </Button>
              </a>
              <Link to={createPageUrl('Workspaces')}>
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white">
                  Start free trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
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
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Free setup • 7-day trial starts after beta access is granted.
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
          <div className="max-w-6xl mx-auto rounded-3xl border border-slate-200 bg-slate-900 text-white p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-3xl font-semibold">Invite-only beta</h2>
                <p className="text-slate-300 mt-2 max-w-2xl">
                  We onboard a limited number of teams each week to keep support tight. Request access to
                  start your 7-day trial when you’re approved.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="mailto:beta@nexus.app?subject=Nexus%20Beta%20Access">
                  <Button variant="outline" className="border-white text-white hover:bg-white/10">
                    Request access
                  </Button>
                </a>
                <Link to={createPageUrl('Workspaces')}>
                  <Button className="bg-white text-slate-900 hover:bg-slate-100">
                    Start free trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-12 px-6 bg-white">
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
            © 2026 Nexus. Invite-only beta.
          </p>
        </div>
      </footer>
    </div>
  );
}
