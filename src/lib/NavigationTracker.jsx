import { useEffect } from 'react';
import { useLocation } from '@/lib/router';
import { useAuth } from './AuthContext';
import { base44 } from '@/api/base44Client';

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    // Log user activity when navigating to a page
    useEffect(() => {
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

        if (isAuthenticated && pageName) {
            base44.appLogs.logUserInApp(pageName).catch(() => {
                // Silently fail - logging shouldn't break the app
            });
        }
    }, [location.pathname, isAuthenticated]);

    return null;
}
