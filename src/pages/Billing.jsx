import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const SERVICES = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'docs', label: 'Docs' },
  { id: 'support', label: 'Support' },
];

export default function Billing() {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selectedServices, setSelectedServices] = useState(new Set());
  const [startingTrial, setStartingTrial] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const storedBoard = sessionStorage.getItem('selectedBoard');
    const storedRole = sessionStorage.getItem('currentRole');

    if (!storedBoard || storedRole !== 'admin') {
      navigate(createPageUrl('Feedback'));
      return;
    }

    const parsedBoard = JSON.parse(storedBoard);
    setBoard(parsedBoard);
    loadSummary(parsedBoard.id);
  }, []);

  const loadSummary = async (boardId) => {
    try {
      const { data } = await base44.functions.invoke('getBillingSummary', {
        board_id: boardId,
      });
      setSummary(data);

      if (data?.enabled_services) {
        setSelectedServices(new Set(data.enabled_services.map((s) => s.service)));
      } else {
        setSelectedServices(new Set(SERVICES.map((s) => s.id)));
      }
    } catch (error) {
      console.error('Failed to load billing summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId, enabled) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(serviceId);
      } else {
        next.delete(serviceId);
      }
      return next;
    });
  };

  const handleStartTrial = async () => {
    if (!board) return;
    const services = Array.from(selectedServices);
    if (services.length === 0) {
      alert('Select at least one service to start the trial.');
      return;
    }

    setStartingTrial(true);
    try {
      const { data } = await base44.functions.invoke('createCheckoutSession', {
        board_id: board.id,
        enabled_services: services,
        success_url: window.location.href,
        cancel_url: window.location.href,
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to start trial:', error);
      alert('Unable to start the trial. Please try again.');
    } finally {
      setStartingTrial(false);
    }
  };

  const handleManageBilling = async () => {
    if (!board) return;
    setOpeningPortal(true);
    try {
      const { data } = await base44.functions.invoke('createBillingPortal', {
        board_id: board.id,
        return_url: window.location.href,
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      alert('Unable to open billing portal.');
    } finally {
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading billing..." />
      </div>
    );
  }

  const statusLabel = summary?.status ?? 'inactive';
  const trialEnd = summary?.trial_end ? new Date(summary.trial_end).toLocaleDateString() : null;
  const periodStart = summary?.current_period_start
    ? new Date(summary.current_period_start).toLocaleDateString()
    : null;
  const periodEnd = summary?.current_period_end
    ? new Date(summary.current_period_end).toLocaleDateString()
    : null;
  const betaGranted = Boolean(summary?.beta_access_granted_at);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Billing</h1>
            <p className="text-slate-500 mt-2">
              Manage pricing, services, and usage for {board?.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate(createPageUrl('WorkspaceSettings'))}>
              Board settings
            </Button>
            <Button onClick={handleManageBilling} disabled={openingPortal || !summary?.status || summary.status === 'inactive'}>
              <CreditCard className="mr-2 h-4 w-4" />
              {openingPortal ? 'Opening...' : 'Manage billing'}
            </Button>
          </div>
        </div>

        {!betaGranted && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-amber-600 mt-1" />
                <div>
                  <p className="font-semibold text-amber-800">Invite-only beta</p>
                  <p className="text-sm text-amber-700">
                    Request access to unlock the 7-day trial.
                  </p>
                </div>
              </div>
              <a href="mailto:beta@nexus.app?subject=Nexus%20Beta%20Access">
                <Button variant="outline" className="border-amber-300 text-amber-800">
                  Request access
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Enabled services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SERVICES.map((service) => (
                <div key={service.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{service.label}</p>
                    <p className="text-xs text-slate-500">$5 / month when enabled</p>
                  </div>
                  <Switch
                    checked={selectedServices.has(service.id)}
                    onCheckedChange={(value) => toggleService(service.id, value)}
                  />
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleStartTrial}
                  disabled={startingTrial || !betaGranted}
                  className="bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {startingTrial ? 'Starting...' : 'Start free trial'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-slate-500 self-center">
                  Trial: 7 days • 50 interactions/day included
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-medium text-slate-900 capitalize">{statusLabel}</span>
              </div>
              {trialEnd && (
                <div className="flex items-center justify-between">
                  <span>Trial ends</span>
                  <span className="font-medium text-slate-900">{trialEnd}</span>
                </div>
              )}
              {periodStart && periodEnd && (
                <div className="flex items-center justify-between">
                  <span>Billing period</span>
                  <span className="font-medium text-slate-900">{periodStart} → {periodEnd}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span>Interactions</span>
                  <span className="font-medium text-slate-900">{summary?.interactions_total ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Billable</span>
                  <span className="font-medium text-slate-900">{summary?.billable_interactions ?? 0}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Services</span>
                  <span className="font-medium text-slate-900">${summary?.service_cost?.toFixed(2) ?? '0.00'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Overage</span>
                  <span className="font-medium text-slate-900">${summary?.overage_cost?.toFixed(2) ?? '0.00'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-900">
                  <span className="font-semibold">Estimated total</span>
                  <span className="font-semibold">${summary?.estimated_total?.toFixed(2) ?? '0.00'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
