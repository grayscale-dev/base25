import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageLoadingState from '@/components/common/PageLoadingState';

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
        // Redirect to login, then back to this page
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setAuthenticated(true);
    } catch {
      base44.auth.redirectToLogin(window.location.href);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return <PageLoadingState fullHeight text="Checking authentication..." />;
  }

  return authenticated ? children : null;
}
