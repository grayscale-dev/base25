import Home from '@/screens/Home';
import { buildMarketingMetadata } from '@/lib/marketing-metadata';

export const metadata = buildMarketingMetadata({
  title: 'Base25 | Feedback, Roadmap, and Changelog for Software Teams',
  description:
    'Base25 is the simplest all-in-one feedback hub for startups and software teams. Collect feedback, share a roadmap, and publish a changelog for one flat $30/month.',
  path: '/',
});

export default function HomePage() {
  return <Home />;
}
