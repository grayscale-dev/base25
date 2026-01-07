import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-slate-100 text-slate-700',
  primary: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  outline: 'border border-slate-200 text-slate-600 bg-white'
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5'
};

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'default',
  className,
  dot
}) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      variants[variant],
      sizes[size],
      className
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          variant === 'success' && 'bg-emerald-500',
          variant === 'warning' && 'bg-amber-500',
          variant === 'danger' && 'bg-red-500',
          variant === 'primary' && 'bg-blue-500',
          variant === 'default' && 'bg-slate-500'
        )} />
      )}
      {children}
    </span>
  );
}