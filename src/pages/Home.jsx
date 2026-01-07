import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin();
        return;
      }
      
      // Check for stored workspace
      const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
      if (storedWorkspace) {
        navigate(createPageUrl('Feedback'));
      } else {
        navigate(createPageUrl('WorkspaceSelector'));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      base44.auth.redirectToLogin();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading..." />
    </div>
  );
}