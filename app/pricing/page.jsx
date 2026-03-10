import Pricing from '@/screens/Pricing';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'Pricing | base25',
  description:
    'Flat $25/month pricing per enabled service. Choose Feedback, Roadmap, and Changelog based on your team needs.',
  path: '/pricing',
});

export default function PricingPage() {
  return <Pricing />;
}
