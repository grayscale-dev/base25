import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Settings, Folder, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any previous session data on landing
    sessionStorage.clear();
  }, []);

  const handlePublicAccess = () => {
    sessionStorage.setItem('isPublicAccess', 'true');
    navigate(createPageUrl('PublicWorkspaceSelector'));
  };

  const handleManagementAccess = async () => {
    sessionStorage.removeItem('isPublicAccess');
    
    try {
      await base44.auth.me();
      navigate(createPageUrl('WorkspaceSelector'));
    } catch (error) {
      base44.auth.redirectToLogin(window.location.origin + createPageUrl('WorkspaceSelector'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-sm rounded-2xl mb-6">
            <Folder className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Feedback Portal
          </h1>
          <p className="text-xl text-slate-300 mb-2">
            Choose your access level
          </p>
          <p className="text-sm text-slate-400">
            Select the appropriate portal based on your role
          </p>
        </div>

        {/* Two Options */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Public Access */}
          <button
            onClick={handlePublicAccess}
            className="bg-white/10 backdrop-blur-sm border-2 border-blue-400/30 rounded-2xl p-8 hover:bg-white/15 hover:border-blue-400/50 transition-all text-left group"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                <Eye className="h-8 w-8 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Customer Portal</h2>
                <p className="text-sm text-blue-200">No login required</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>View and submit feedback</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Browse product roadmap</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Track release history</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Access support resources</span>
              </li>
            </ul>
            <div className="flex items-center text-blue-300 font-medium group-hover:translate-x-2 transition-transform">
              Enter Customer Portal
              <span className="ml-2">→</span>
            </div>
          </button>

          {/* Management Access */}
          <button
            onClick={handleManagementAccess}
            className="bg-white/10 backdrop-blur-sm border-2 border-purple-400/30 rounded-2xl p-8 hover:bg-white/15 hover:border-purple-400/50 transition-all text-left group"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                <Settings className="h-8 w-8 text-purple-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Admin Portal</h2>
                <p className="text-sm text-purple-200 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Requires authentication
                </p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-0.5">✓</span>
                <span>Create and manage workspaces</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-0.5">✓</span>
                <span>Configure settings and permissions</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-0.5">✓</span>
                <span>Moderate and respond to feedback</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-0.5">✓</span>
                <span>Manage roadmap and releases</span>
              </li>
            </ul>
            <div className="flex items-center text-purple-300 font-medium group-hover:translate-x-2 transition-transform">
              Enter Admin Portal
              <span className="ml-2">→</span>
            </div>
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400">
            Not sure which to choose? Use <span className="text-blue-300">Customer Portal</span> to view and submit feedback
          </p>
        </div>
      </div>
    </div>
  );
}