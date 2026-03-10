import Features from '@/screens/Features';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'Features | base25',
  description:
    'Explore feedback management, roadmap planning, changelog publishing, and connected workflows in base25.',
  path: '/features',
});

export default function FeaturesPage() {
  return <Features />;
}
