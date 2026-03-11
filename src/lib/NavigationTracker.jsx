import { useEffect } from 'react';
import { useLocation } from '@/lib/router';
import { base44 } from '@/api/base44Client';

export default function NavigationTracker() {
    const location = useLocation();

    // Log user activity when navigating to a page
    useEffect(() => {
        let cancelled = false;

        // Extract page name from pathname
        const pathname = location.pathname;
        let pageName = null;

        if (pathname === '/' || pathname === '') {
            pageName = 'Home';
        } else if (pathname.startsWith('/workspace/')) {
            pageName = 'Workspace';
        } else {
            pageName = pathname.replace(/^\//, '').split('/')[0] || null;
        }

        if (!pageName) {
            return () => {
              cancelled = true;
            };
        }

        const track = async () => {
            const isAuthenticated = await base44.auth.isAuthenticated();
            if (cancelled || !isAuthenticated) {
              return;
            }
            base44.appLogs.logUserInApp(pageName).catch(() => {
                // Silently fail - logging shouldn't break the app
            });
        };

        void track();

        return () => {
          cancelled = true;
        };
    }, [location.pathname]);

    return null;
}
