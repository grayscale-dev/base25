import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const toneConfig = {
  info: {
    panel: 'border-blue-200 bg-blue-50 text-blue-900',
    banner: 'border border-blue-200 bg-blue-50 text-blue-900',
    icon: Info,
  },
  warning: {
    panel: 'border-amber-200 bg-amber-50 text-amber-900',
    banner: 'border border-amber-200 bg-amber-50 text-amber-900',
    icon: AlertTriangle,
  },
  danger: {
    panel: 'border-rose-200 bg-rose-50 text-rose-900',
    banner: 'border border-rose-200 bg-rose-50 text-rose-900',
    icon: ShieldAlert,
  },
  success: {
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    banner: 'border border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: CheckCircle2,
  },
  neutral: {
    panel: 'border-slate-200 bg-white text-slate-900',
    banner: 'border border-slate-200 bg-white text-slate-900',
    icon: Info,
  },
};

export function StateBanner({
  tone = 'info',
  icon: Icon,
  message,
  action,
  actionLabel,
  className,
}) {
  if (!message) {
    return null;
  }

  const config = toneConfig[tone] || toneConfig.info;
  const ResolvedIcon = Icon || config.icon;

  return (
    <div className={cn('rounded-lg px-4 py-3', config.banner, className)}>
      <div className="flex items-start gap-2.5">
        <ResolvedIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm leading-6">
          {message}
          {action && actionLabel ? (
            <button
              type="button"
              onClick={action}
              className="ml-1 inline underline decoration-current underline-offset-2 hover:opacity-80"
            >
              {actionLabel}
            </button>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export function StatePanel({
  tone = 'neutral',
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  className,
  centered = true,
}) {
  const config = toneConfig[tone] || toneConfig.neutral;
  const ResolvedIcon = Icon || config.icon;

  return (
    <section
      className={cn(
        'rounded-2xl border p-8 shadow-sm',
        config.panel,
        centered && 'mx-auto max-w-xl text-center',
        className
      )}
    >
      <div className={cn('flex flex-col gap-4', centered ? 'items-center' : 'items-start')}>
        {ResolvedIcon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70">
            <ResolvedIcon className="h-6 w-6" />
          </div>
        ) : null}
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? <p className="mt-2 text-sm opacity-90">{description}</p> : null}
        </div>
        {(action && actionLabel) || (secondaryAction && secondaryActionLabel) ? (
          <div className={cn('flex flex-wrap gap-3', centered ? 'justify-center' : 'justify-start')}>
            {action && actionLabel ? (
              <Button onClick={action} className="bg-slate-900 text-white hover:bg-slate-800">
                {actionLabel}
              </Button>
            ) : null}
            {secondaryAction && secondaryActionLabel ? (
              <Button variant="outline" onClick={secondaryAction}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
