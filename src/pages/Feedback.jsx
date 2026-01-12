import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useBoardContext } from '@/components/context/BoardContext';
import FeedbackForm from '@/components/feedback/FeedbackForm';
import FeedbackCard from '@/components/feedback/FeedbackCard';
import FeedbackDetail from '@/components/feedback/FeedbackDetail';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function Feedback() {
  const navigate = useNavigate();
  const { workspace, user, permissions, messages, isPublicAccess, loading: contextLoading } = useBoardContext();
  const [feedbackList, setFeedbackList] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!contextLoading && workspace) {
      loadData();
    }
  }, [contextLoading, workspace]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const feedbackId = params.get('id');
    if (feedbackId && feedbackList.length > 0) {
      const fb = feedbackList.find(f => f.id === feedbackId);
      if (fb) {
        handleFeedbackClick(fb);
      }
    }
  }, [feedbackList]);

  const loadData = async () => {
    try {
      const workspaceId = workspace?.id;
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      
      // Use public endpoint if unauthenticated or public access
      if (!user || isPublicAccess) {
        const { data } = await base44.functions.invoke('publicGetFeedback', {
          board_id: workspaceId
        });
        
        if (data && data.items) {
          setFeedbackList(data.items);
          
          // Response counts included in public API
          const responseCounts = {};
          data.items.forEach(item => {
            responseCounts[item.id] = item.response_count || 0;
          });
          setResponses(responseCounts);
        }
      } else {
        // Authenticated user with role
        const feedback = await base44.entities.Feedback.filter(
          { board_id: workspaceId },
          '-created_date'
        );
        setFeedbackList(feedback);

        // Load response counts
        const allResponses = await base44.entities.FeedbackResponse.filter(
          { board_id: workspaceId }
        );
        const responseCounts = {};
        allResponses.forEach(r => {
          responseCounts[r.feedback_id] = (responseCounts[r.feedback_id] || 0) + 1;
        });
        setResponses(responseCounts);
      }
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbackResponses = async (feedbackId) => {
    const workspaceId = workspace?.id;
    
    // Use public endpoint if unauthenticated or public access
    if (!user || isPublicAccess) {
      const { data } = await base44.functions.invoke('publicGetFeedbackDetail', {
        feedback_id: feedbackId,
        board_id: workspaceId
      });
      
      return data?.responses || [];
    } else {
      // Authenticated user with role
      const feedbackResponses = await base44.entities.FeedbackResponse.filter(
        { feedback_id: feedbackId, board_id: workspaceId },
        'created_date'
      );
      return feedbackResponses;
    }
  };

  const handleFeedbackClick = async (feedback) => {
    const feedbackResponses = await loadFeedbackResponses(feedback.id);
    setSelectedFeedback({ feedback, responses: feedbackResponses, slug: workspace?.slug });
  };

  const handleFormSuccess = () => {
    setShowNewForm(false);
    loadData();
  };

  const handleFeedbackUpdate = async () => {
    await loadData();
    if (selectedFeedback) {
      const feedbackResponses = await loadFeedbackResponses(selectedFeedback.feedback.id);
      // Refresh the feedback data
      const updatedFeedback = feedbackList.find(f => f.id === selectedFeedback.feedback.id);
      if (updatedFeedback) {
        setSelectedFeedback({ feedback: updatedFeedback, responses: feedbackResponses });
      }
    }
  };



  // Filter feedback
  const filteredFeedback = feedbackList.filter(fb => {
    if (searchQuery && !fb.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (typeFilter !== 'all' && fb.type !== typeFilter) {
      return false;
    }
    if (statusFilter !== 'all' && fb.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading feedback..." />
      </div>
    );
  }

  if (selectedFeedback) {
    return (
      <FeedbackDetail
        feedback={selectedFeedback.feedback}
        responses={selectedFeedback.responses}
        workspaceName={workspace?.name}
        workspaceSlug={selectedFeedback.slug}
        isStaff={permissions.isStaff}
        onBack={() => setSelectedFeedback(null)}
        onUpdate={handleFeedbackUpdate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Access messages */}
      {messages.loginPrompt && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="text-blue-900">
            👀 {messages.loginPrompt}. <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="underline font-medium">Login</button>
          </p>
        </div>
      )}
      {messages.accessDenied && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          <p className="text-amber-900">
            ⚠️ {messages.accessDenied}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback</h1>
          <p className="text-slate-500 mt-1">
            {feedbackList.length} feedback items
          </p>
        </div>
        {permissions.canCreateFeedback && (
          <Button 
            onClick={() => setShowNewForm(true)}
            style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Submit Feedback
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search feedback..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bug">🐛 Bug</SelectItem>
            <SelectItem value="feature_request">✨ Feature</SelectItem>
            <SelectItem value="improvement">📈 Improvement</SelectItem>
            <SelectItem value="question">❓ Question</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      {filteredFeedback.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No feedback found"
          description={feedbackList.length === 0 
            ? "Be the first to submit feedback!" 
            : "Try adjusting your filters"}
          action={permissions.canCreateFeedback && feedbackList.length === 0 ? () => setShowNewForm(true) : undefined}
          actionLabel={permissions.canCreateFeedback && feedbackList.length === 0 ? "Submit Feedback" : undefined}
        />
      ) : (
        <div className="grid gap-4">
          {filteredFeedback.map((feedback) => (
            <FeedbackCard
              key={feedback.id}
              feedback={feedback}
              onClick={() => handleFeedbackClick(feedback)}
              showPriority={permissions.isStaff}
              responseCount={responses[feedback.id] || 0}
            />
          ))}
        </div>
      )}

      {/* New Feedback Modal */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
          </DialogHeader>
          <FeedbackForm
            workspaceId={workspace?.id}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowNewForm(false)}
            allowAttachments={workspace?.settings?.allow_attachments !== false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}