import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageLoadingState from '@/components/common/PageLoadingState';
import { createPageUrl } from '@/utils';

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        window.location.replace(createPageUrl('Home'));
        return;
      }
      setAuthenticated(true);
    } catch {
      window.location.replace(createPageUrl('Home'));
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return <PageLoadingState fullHeight text="Checking authentication..." />;
  }

  return authenticated ? children : null;
}
