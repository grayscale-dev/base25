import { Folder, MessageSquare, GitBranch, Users, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Badge from '@/components/common/Badge';
import { cn } from '@/lib/utils';

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
        {workspace.logo_url ? (
          <img src={workspace.logo_url} alt={workspace.name} className="h-12 w-12 object-contain rounded-xl" />
        ) : (
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: workspace.primary_color || '#0f172a' }}>
            <Folder className="h-5 w-5 text-white" />
          </div>
        )}
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
        <Badge variant={role === 'admin' ? 'primary' : role === 'support' ? 'purple' : 'default'}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
        
        {workspace.visibility === 'public' && (
          <Badge variant="outline">Public</Badge>
        )}
        
        {workspace.support_enabled && (
          <Badge variant="outline" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Support
          </Badge>
        )}
      </div>
    </Card>
  );
}