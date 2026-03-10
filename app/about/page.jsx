import About from '@/screens/About';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'About | base25',
  description:
    'Learn how base25 helps modern teams stay connected to customer feedback, roadmap priorities, and release communication.',
  path: '/about',
});

export default function AboutPage() {
  return <About />;
}
