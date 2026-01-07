import { ChevronDown, Settings, Key, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Badge from '@/components/common/Badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function WorkspaceHeader({ workspace, workspaces, role, onSwitch, isAdmin }) {
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
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('WorkspaceSelector')} className="cursor-pointer">
                View all workspaces
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Badge variant={role === 'admin' ? 'primary' : role === 'support' ? 'purple' : 'default'}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
      </div>
      
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link to={createPageUrl('ApiDocs')}>
            <Button variant="ghost" size="sm" className="text-slate-600">
              <Key className="h-4 w-4 mr-2" />
              API
            </Button>
          </Link>
          <Link to={createPageUrl('WorkspaceSettings')}>
            <Button variant="ghost" size="sm" className="text-slate-600">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}