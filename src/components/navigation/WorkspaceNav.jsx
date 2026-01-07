import { Link, useLocation } from 'react-router-dom';
import { MessageSquareText, Map, HeadphonesIcon, Settings, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

const navItems = [
  { name: 'Feedback', icon: MessageSquareText, page: 'Feedback', permission: 'view_feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap', permission: 'view_roadmap' },
  { name: 'Support', icon: HeadphonesIcon, page: 'Support', permission: 'view_own_tickets', requiresSupport: true },
];

const adminItems = [
  { name: 'Settings', icon: Settings, page: 'WorkspaceSettings' },
  { name: 'API Docs', icon: FileCode, page: 'ApiDocs' },
];

export default function WorkspaceNav({ hasPermission, isAdmin, supportEnabled }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (page) => {
    const pageUrl = createPageUrl(page);
    return currentPath === pageUrl || currentPath.startsWith(pageUrl + '?');
  };

  const visibleItems = navItems.filter(item => {
    if (item.requiresSupport && !supportEnabled) return false;
    return hasPermission(item.permission);
  });

  return (
    <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.page);
        
        return (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              active 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}