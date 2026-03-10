"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProfileCompletionModal from '@/components/auth/ProfileCompletionModal';

export default function AppAuthGate({ children }) {
  const pathname = usePathname();
  const {
    user,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    navigateToLogin,
    checkAppState,
    logout,
  } = useAuth();

  const requiresNameCompletion = Boolean(
    user && (!user.first_name?.trim() || !user.last_name?.trim())
  );
  const isWorkspaceContentRoute = (pathname || '').startsWith('/workspace/');
  const shouldShowProfileCompletion = requiresNameCompletion && isWorkspaceContentRoute;

  useEffect(() => {
    if (authError?.type === 'auth_required') {
      navigateToLogin();
    }
  }, [authError, navigateToLogin]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authError?.type === 'auth_required') {
    return null;
  }

  return (
    <>
      {children}
      <ProfileCompletionModal
        isOpen={shouldShowProfileCompletion}
        allowCancel={false}
        initialFirstName={user?.first_name || ''}
        initialLastName={user?.last_name || ''}
        onComplete={() => {
          void checkAppState();
        }}
        onCancel={() => {
          logout(true);
        }}
      />
    </>
  );
}
