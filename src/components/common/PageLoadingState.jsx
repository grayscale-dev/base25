import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function PageLoadingState({
  text = 'Loading...',
  fullHeight = false,
  className,
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullHeight ? 'min-h-screen' : 'min-h-[60vh]',
        className
      )}
    >
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
