import Features from '@/screens/Features';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'Features | Base25',
  description:
    'Explore how Base25 helps software teams run feedback, roadmap, and changelog workflows in one focused product.',
  path: '/features',
});

export default function FeaturesPage() {
  return <Features />;
}
