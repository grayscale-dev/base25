import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, Map, HeadphonesIcon, BookOpen, Sparkles, Workflow, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function Home() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company_name: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.notes) return;
    
    setSubmitting(true);
    try {
      await base44.functions.invoke('publicWaitlistSignup', formData);
      setSubmitted(true);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        company_name: '',
        notes: ''
      });
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: MessageSquareText,
      title: 'Feedback Management',
      description: 'Collect, organize, and prioritize customer feedback in one place'
    },
    {
      icon: Map,
      title: 'Product Roadmap',
      description: 'Share your plans and keep users informed about what\'s coming'
    },
    {
      icon: Sparkles,
      title: 'Changelog',
      description: 'Announce updates and keep your community engaged'
    },
    {
      icon: BookOpen,
      title: 'Documentation',
      description: 'Build comprehensive docs with questions and comments'
    },
    {
      icon: HeadphonesIcon,
      title: 'Support Threads',
      description: 'Provide stellar support with organized conversation threads'
    },
    {
      icon: Workflow,
      title: 'Workflow Automation',
      description: 'Connect everything - feedback, roadmaps, docs, and support'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ee36fb2c36c191b58c83e/678f5e1e6_create-a-svg-like-these-except-it-is-rock-on-symbo.png" 
              alt="Nexus" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-slate-900">Nexus</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to={createPageUrl('About')} className="text-sm font-medium text-slate-600 hover:text-slate-900">About</Link>
            <Link to={createPageUrl('Pricing')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</Link>
          </nav>
          
          <Link to={createPageUrl('Workspaces')}>
            <Button className="bg-slate-900 hover:bg-slate-800">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Now in Private Beta
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Your customer feedback hub
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
            Nexus brings together feedback, roadmaps, documentation, and support in one beautiful platform. 
            Build better products by staying connected with your users.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Everything you need to stay connected with customers
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-all"
                >
                  <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-white mb-4">
              Join the Private Beta
            </h2>
            <p className="text-xl text-slate-300">
              Get early access to Nexus and help shape the future of customer feedback
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">You're on the list!</h3>
              <p className="text-slate-600">We'll reach out soon with your beta access.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="company_name">Company Name (Optional)</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="notes">Why do you want early access? *</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  required
                  placeholder="Tell us about your team and what you're looking for..."
                  className="mt-1.5 min-h-[120px]"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800"
                size="lg"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    Request Beta Access
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6">
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
            © 2026 Nexus. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}