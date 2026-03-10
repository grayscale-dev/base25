import Home from '@/screens/Home';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'base25 | Customer Feedback Hub',
  description:
    'Collect feedback, publish your roadmap, and ship updates with a single workflow built for product teams.',
  path: '/',
});

export default function HomePage() {
  return <Home />;
}
