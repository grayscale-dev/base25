import { ChevronDown, Settings, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Badge from '@/components/common/Badge';
import { createPageUrl } from '@/utils';
import Link from '@/components/common/AppLink';

export default function WorkspaceHeader({ workspace, workspaces, role, onSwitch }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-2 hover:bg-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <Folder className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{workspace.name}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {workspaces.map((ws) => (
              <DropdownMenuItem 
                key={ws.id} 
                onClick={() => onSwitch(ws)}
                className="cursor-pointer"
              >
                <Folder className="h-4 w-4 mr-2 text-slate-500" />
                <span>{ws.name}</span>
                {ws.id === workspace.id && (
                  <span className="ml-auto text-xs text-slate-400">Current</span>
                )}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => { window.location.href = createPageUrl('WorkspaceSelector'); }}
              className="cursor-pointer"
            >
                View all workspaces
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Badge variant={role === 'admin' ? 'primary' : 'default'}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
      </div>
      
      {role && (
        <div className="flex items-center gap-2">
          <Link to={createPageUrl('WorkspaceSettings')}>
            <Button
              variant="ghost"
              className="h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
