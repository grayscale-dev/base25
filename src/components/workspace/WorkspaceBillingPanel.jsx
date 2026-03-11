import { useEffect, useState } from "react";
import { ArrowRight, CreditCard, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { toast } from "@/components/ui/use-toast";

const SERVICES = [
  { id: "feedback", label: "Feedback" },
  { id: "roadmap", label: "Roadmap" },
  { id: "changelog", label: "Changelog" },
];

const SERVICE_PRICE = 25;

export default function WorkspaceBillingPanel({ workspace }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selectedServices, setSelectedServices] = useState(new Set());
  const [startingTrial, setStartingTrial] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [loadError, setLoadError] = useState("");

  const workspaceId = workspace?.id || null;

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    void loadSummary(workspaceId);
  }, [workspaceId]);

  const loadSummary = async (nextWorkspaceId) => {
    if (!nextWorkspaceId) return;
    try {
      setLoadError("");
      setLoading(true);
      const { data } = await base44.functions.invoke("getBillingSummary", {
        workspace_id: nextWorkspaceId,
      });
      setSummary(data);

      if (data?.enabled_services) {
        setSelectedServices(new Set(data.enabled_services.map((service) => service.service)));
      } else {
        setSelectedServices(new Set(SERVICES.map((service) => service.id)));
      }
    } catch (error) {
      console.error("Failed to load billing summary:", error);
      setLoadError("Unable to load billing details. Please try again.");
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
    if (!workspaceId) return;
    const services = Array.from(selectedServices);
    if (services.length === 0) {
      toast({
        title: "Action required",
        description: "Select at least one service to continue to checkout.",
        variant: "destructive",
      });
      return;
    }

    setStartingTrial(true);
    try {
      const { data } = await base44.functions.invoke("createCheckoutSession", {
        workspace_id: workspaceId,
        enabled_services: services,
        success_url: window.location.href,
        cancel_url: window.location.href,
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to start trial:", error);
      toast({
        title: "Action failed",
        description: "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingTrial(false);
    }
  };

  const handleManageBilling = async () => {
    if (!workspaceId) return;
    setOpeningPortal(true);
    try {
      const { data } = await base44.functions.invoke("createBillingPortal", {
        workspace_id: workspaceId,
        return_url: window.location.href,
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      toast({
        title: "Action failed",
        description: "Unable to open the billing portal right now.",
        variant: "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return <PageLoadingState text="Loading billing..." />;
  }

  if (!workspaceId) {
    return (
      <StatePanel
        tone="danger"
        title="Billing unavailable"
        description="Select a workspace to manage billing."
      />
    );
  }

  if (loadError) {
    return (
      <StatePanel
        tone="danger"
        title="Billing is unavailable"
        description={loadError}
        action={() => {
          void loadSummary(workspaceId);
        }}
        actionLabel="Retry"
      />
    );
  }

  const statusLabel = summary?.status ?? "inactive";
  const trialEnd = summary?.trial_end ? new Date(summary.trial_end).toLocaleDateString() : null;
  const periodStart = summary?.current_period_start
    ? new Date(summary.current_period_start).toLocaleDateString()
    : null;
  const periodEnd = summary?.current_period_end
    ? new Date(summary.current_period_end).toLocaleDateString()
    : null;
  const enabledCount = summary?.active_service_count ?? selectedServices.size;
  const monthlyTotal = summary?.service_cost ?? enabledCount * SERVICE_PRICE;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Enabled Services</CardTitle>
            <Button
              onClick={handleManageBilling}
              disabled={openingPortal || !summary?.status || summary.status === "inactive"}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {openingPortal ? "Opening..." : "Manage Billing"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {SERVICES.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{service.label}</p>
                  <p className="text-xs text-slate-500">${SERVICE_PRICE} / month when enabled</p>
                </div>
                <Switch
                  checked={selectedServices.has(service.id)}
                  onCheckedChange={(value) => toggleService(service.id, value)}
                />
              </div>
            ))}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                onClick={handleStartTrial}
                disabled={startingTrial || selectedServices.size === 0}
                className="bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {startingTrial ? "Starting..." : "Start Free Trial"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="self-center text-sm text-slate-500">
                Trial: 7 days • flat service pricing after trial
              </p>
            </div>

            {selectedServices.size === 0 ? (
              <p className="text-sm text-amber-700">
                Enable at least one service to continue to checkout.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-medium capitalize text-slate-900">{statusLabel}</span>
            </div>
            {trialEnd ? (
              <div className="flex items-center justify-between">
                <span>Trial ends</span>
                <span className="font-medium text-slate-900">{trialEnd}</span>
              </div>
            ) : null}
            {periodStart && periodEnd ? (
              <div className="flex items-center justify-between">
                <span>Billing period</span>
                <span className="font-medium text-slate-900">
                  {periodStart} {"->"} {periodEnd}
                </span>
              </div>
            ) : null}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span>Enabled services</span>
                <span className="font-medium text-slate-900">{enabledCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Price per service</span>
                <span className="font-medium text-slate-900">${SERVICE_PRICE.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-900">
                <span className="font-semibold">Monthly total</span>
                <span className="font-semibold">${monthlyTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
