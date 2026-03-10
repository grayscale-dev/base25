import { cn } from '@/lib/utils';

export function PageShell({ children, className }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

export function PageHeader({
  title,
  titleNode,
  description,
  actions,
  eyebrow,
  className,
  titleClassName,
  descriptionClassName,
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
        ) : null}
        {titleNode ? (
          <div className={cn("mt-1", titleClassName)}>{titleNode}</div>
        ) : (
          <h1 className={cn('mt-1 text-2xl font-bold text-slate-900 sm:text-3xl', titleClassName)}>{title}</h1>
        )}
        {description ? (
          <p className={cn('mt-2 max-w-3xl text-sm text-slate-500 sm:text-base', descriptionClassName)}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
