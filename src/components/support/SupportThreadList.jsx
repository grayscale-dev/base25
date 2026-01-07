import { Clock, MessageSquare, User, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Badge from '@/components/common/Badge';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig = {
  open: { label: 'Open', variant: 'primary', dot: true },
  awaiting_user: { label: 'Awaiting You', variant: 'warning', dot: true },
  awaiting_support: { label: 'Awaiting Support', variant: 'default', dot: true },
  resolved: { label: 'Resolved', variant: 'success', dot: true },
  closed: { label: 'Closed', variant: 'default', dot: false },
};

const priorityConfig = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
  urgent: { label: 'Urgent', variant: 'danger' },
};

export default function SupportThreadList({ threads, onSelect, isStaff }) {
  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <MessageSquare className="h-8 w-8 mx-auto mb-3 text-slate-300" />
        <p>No support threads yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => {
        const statusInfo = statusConfig[thread.status] || statusConfig.open;
        const priorityInfo = thread.priority ? priorityConfig[thread.priority] : null;

        return (
          <Card
            key={thread.id}
            className={cn(
              'p-4 cursor-pointer transition-all duration-200',
              'hover:shadow-md hover:border-slate-300 bg-white'
            )}
            onClick={() => onSelect(thread)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge 
                    variant={statusInfo.variant} 
                    size="sm"
                    dot={statusInfo.dot}
                  >
                    {statusInfo.label}
                  </Badge>
                  {isStaff && priorityInfo && (
                    <Badge variant={priorityInfo.variant} size="sm">
                      {priorityInfo.label}
                    </Badge>
                  )}
                </div>
                
                <h3 className="font-medium text-slate-900 mb-1 line-clamp-1">
                  {thread.subject}
                </h3>
                
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  {isStaff && thread.requester_email && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {thread.requester_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {thread.last_message_at 
                      ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
                      : format(new Date(thread.created_date), 'MMM d, yyyy')
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {thread.message_count || 0} messages
                  </span>
                </div>
              </div>
              
              <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}