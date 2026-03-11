import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Badge from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import WorkspaceAvatar from '@/components/workspace/WorkspaceAvatar';
import { getRoleLabel, isAdminRole } from '@/lib/roles';

export default function WorkspaceCard({ workspace, role, onClick }) {
  return (
    <Card 
      className={cn(
        'group p-6 cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300',
        'bg-white border-slate-200'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <WorkspaceAvatar workspace={workspace} size="lg" />
        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
      </div>
      
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        {workspace.name}
      </h3>
      
      {workspace.description && (
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">
          {workspace.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={isAdminRole(role) ? 'primary' : 'default'}>
          {getRoleLabel(role)}
        </Badge>
        
        {workspace.visibility === 'public' && (
          <Badge variant="outline">Public</Badge>
        )}
      </div>
    </Card>
  );
}
