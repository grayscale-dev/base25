import About from '@/screens/About';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'About | Base25',
  description:
    'Learn why Base25 is built for startup software teams that want a simpler way to manage feedback, roadmap communication, and changelog updates.',
  path: '/about',
});

export default function AboutPage() {
  return <About />;
}
