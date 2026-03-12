import Pricing from '@/screens/Pricing';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'Pricing | Base25',
  description:
    'Base25 pricing is one flat $30/month plan. No tiers, no add-ons, and no modular pricing confusion.',
  path: '/pricing',
});

export default function PricingPage() {
  return <Pricing />;
}
