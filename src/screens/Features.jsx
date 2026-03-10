"use client";

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PublicPageLayout from '@/components/common/PublicPageLayout';
import { MarketingCtaBanner, MarketingHeroActions } from '@/components/common/PublicMarketingBlocks';
import { publicRoutes } from '@/lib/public-routes';

const features = [
  {
    id: 'feedback-management',
    title: 'Feedback Management',
    description:
      'Collect, categorize, and prioritize feedback with rich metadata, tags, and visibility controls. Keep signal high and responses fast.',
    bullets: [
      'Public or private feedback workspaces',
      'Tagging, status flows, and ownership',
      'Attach screenshots and files',
    ],
    image: '/feedback-page.png',
  },
  {
    id: 'product-roadmap',
    title: 'Product Roadmap',
    description:
      'Share what is planned, in progress, and shipped with a clean, public-facing roadmap. Keep internal context connected to user demand.',
    bullets: [
      'Kanban-style planning',
      'Status updates and progress notes',
      'Link feedback to roadmap items',
    ],
    image: '/roadmap.png',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    description:
      'Celebrate shipped work and keep customers in the loop with a polished changelog that is easy to scan and share.',
    bullets: [
      'Release notes with tags',
      'Visibility controls (public/internal)',
      'Link updates back to roadmap items',
    ],
    image: '/changelog.png',
  },
  {
    id: 'workflow-automation',
    title: 'Workflow Automation',
    description:
      'Connect feedback, roadmap, and changelog so every team works from the same source of truth.',
    bullets: [
      'Cross-link entities with shared IDs',
      'Unified workspace permissions',
      'Analytics-ready event tracking',
    ],
    image: '/workflow-auto.png',
  },
];

export default function Features() {
  const [activeImage, setActiveImage] = useState(null);

  return (
    <>
      <PublicPageLayout currentPage="features">
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto text-center space-y-6 relative">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">
              Features
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900">
              Everything{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-500">
                base25
              </span>{' '}
              ships for modern product teams
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Each feature connects back to customer conversations.
            </p>
            <MarketingHeroActions />
          </div>
        </section>

        <section className="px-6 pb-12">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.18em]">
                Jump to
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {features.map((feature) => (
                  <a
                    key={feature.id}
                    href={`#${feature.id}`}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300 hover:text-slate-900"
                  >
                    {feature.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="max-w-6xl mx-auto space-y-24">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                id={feature.id}
                className={`scroll-mt-28 grid lg:grid-cols-2 gap-12 items-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm ${
                  index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.18em]">
                    {feature.title}
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 mt-3">
                    {feature.title}
                  </h2>
                  <p className="text-slate-600 mt-4 text-lg">
                    {feature.description}
                  </p>
                  <ul className="mt-6 space-y-2">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-slate-600">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveImage(feature)}
                  className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  <img
                    src={feature.image}
                    alt={`${feature.title} screenshot`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-20">
          <MarketingCtaBanner
            title="Ready to go deeper?"
            description="See how base25 keeps every team aligned to the same customer story."
            primaryLabel="See pricing"
            primaryTo={publicRoutes.pricing}
            secondaryLabel="Get started"
            secondaryTo={publicRoutes.workspaceHub}
          />
        </section>
      </PublicPageLayout>

      <Dialog open={!!activeImage} onOpenChange={(open) => !open && setActiveImage(null)}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
          {activeImage ? (
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xl">
              <img
                src={activeImage.image}
                alt={`${activeImage.title} preview`}
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
