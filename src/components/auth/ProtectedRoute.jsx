import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageLoadingState from '@/components/common/PageLoadingState';
import { publicRoutes } from '@/lib/public-routes';

function buildSignInUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const signInUrl = new URL(publicRoutes.signIn, window.location.origin);
  signInUrl.searchParams.set("returnTo", returnTo);
  return signInUrl.toString();
}

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
        window.location.replace(buildSignInUrl());
        return;
      }
      setAuthenticated(true);
    } catch {
      window.location.replace(buildSignInUrl());
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return <PageLoadingState fullHeight text="Checking authentication..." />;
  }

  return authenticated ? children : null;
}
