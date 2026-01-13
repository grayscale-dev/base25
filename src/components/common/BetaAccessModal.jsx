import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const defaultForm = {
  first_name: '',
  last_name: '',
  email: '',
  company_name: '',
  notes: '',
};

export default function BetaAccessModal({ open, onOpenChange, onSubmitted }) {
  const [formData, setFormData] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData(defaultForm);
    setSubmitting(false);
    setSubmitted(false);
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.notes) {
      return;
    }

    setSubmitting(true);
    try {
      await base44.functions.invoke('publicWaitlistSignup', formData);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request beta access</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">You are on the list!</h3>
            <p className="text-slate-600">We will reach out soon with your beta access.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="beta_first_name">First Name *</Label>
                <Input
                  id="beta_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="beta_last_name">Last Name *</Label>
                <Input
                  id="beta_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="beta_email">Email *</Label>
              <Input
                id="beta_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="beta_company_name">Company Name (Optional)</Label>
              <Input
                id="beta_company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="beta_notes">Why do you want early access? *</Label>
              <Textarea
                id="beta_notes"
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
                  Request beta access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
