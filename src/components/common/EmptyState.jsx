import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  actionLabel,
  className 
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      {Icon && (
        <div className="mb-4 p-4 bg-slate-100 rounded-2xl">
          <Icon className="h-8 w-8 text-slate-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <Button onClick={action} className="bg-slate-900 hover:bg-slate-800">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}