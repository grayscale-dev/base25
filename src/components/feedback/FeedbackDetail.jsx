import { useState } from 'react';
import { 
  ArrowLeft, ThumbsUp, Clock, User, Paperclip, 
  Tag, AlertCircle, Link as LinkIcon, Plus, Edit2, Send, Map, Sparkles 
} from 'lucide-react';
import AddToRoadmapModal from './AddToRoadmapModal';
import LinksPanel from '@/components/common/LinksPanel';
import { createPageUrl } from '@/utils';
import { boardUrl } from '@/components/utils/boardUrl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Badge from '@/components/common/Badge';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useProfileGuard } from '@/components/auth/useProfileGuard';

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: 'declined', label: 'Declined' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function FeedbackDetail({ 
  feedback, 
  responses, 
  workspaceName,
  workspaceSlug,
  isStaff, 
  onBack, 
  onUpdate,
  onAddToRoadmap 
}) {
  const { guardAction, ProfileGuard } = useProfileGuard();
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [status, setStatus] = useState(feedback.status);
  const [priority, setPriority] = useState(feedback.priority || '');
  const [showAddToRoadmap, setShowAddToRoadmap] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    
    setSubmitting(true);
    try {
      // Check if user has permission to reply
      const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
      if (isPublicAccess) {
        alert('Please login with proper permissions to post responses.');
        setSubmitting(false);
        return;
      }

      await guardAction(async () => {
        const user = await base44.auth.me();
        
        await base44.entities.FeedbackResponse.create({
          feedback_id: feedback.id,
          workspace_id: feedback.workspace_id,
          content: replyContent,
          author_id: user.id,
          is_official: isStaff,
          author_role: isStaff ? 'support' : 'user',
        });
        
        setReplyContent('');
        onUpdate?.();
      });
    } catch (error) {
      if (error.message === 'Profile completion cancelled') {
        // User cancelled - don't show error
      } else {
        console.error('Failed to submit reply:', error);
        alert('Failed to submit reply. Please ensure you have permission.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMeta = async () => {
    try {
      await base44.entities.Feedback.update(feedback.id, { status, priority });
      setEditingMeta(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  const typeConfig = {
    bug: { label: 'Bug Report', emoji: '🐛' },
    feature_request: { label: 'Feature Request', emoji: '✨' },
    improvement: { label: 'Improvement', emoji: '📈' },
    question: { label: 'Question', emoji: '❓' },
  };

  const typeInfo = typeConfig[feedback.type] || typeConfig.bug;

  return (
    <>
      <ProfileGuard />
      <div className="max-w-4xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-6 text-slate-600">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Feedback
      </Button>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{typeInfo.emoji}</span>
                <span className="text-sm text-slate-500">{typeInfo.label}</span>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-4">
                {feedback.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(feedback.created_date), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {feedback.vote_count || 0} votes
                </span>
              </div>
            </div>
            
            {isStaff && (
              <div className="flex items-center gap-2">
                {!feedback.roadmap_item_id && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddToRoadmap(true)}
                    className="text-slate-600"
                  >
                    <Map className="h-4 w-4 mr-1" />
                    Add to Roadmap
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingMeta(!editingMeta)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Meta editing */}
          {editingMeta && isStaff && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Set priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingMeta(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveMeta} className="bg-slate-900 hover:bg-slate-800">
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Links Panel */}
          <LinksPanel
            workspaceId={sessionStorage.getItem('selectedWorkspaceId')}
            workspaceSlug={workspaceSlug || sessionStorage.getItem('selectedWorkspace')?.slug}
            itemType="feedback"
            itemId={feedback.id}
            links={{
              roadmap_item_ids: feedback.roadmap_item_ids || [],
              changelog_entry_ids: feedback.changelog_entry_ids || [],
              doc_page_ids: feedback.doc_page_ids || []
            }}
            onUpdate={onUpdate}
            isStaff={isStaff}
          />
        </div>

        {/* Description */}
        <div className="p-6">
          <p className="text-slate-700 whitespace-pre-wrap">{feedback.description}</p>
          
          {/* Additional details */}
          {(feedback.steps_to_reproduce || feedback.expected_behavior || feedback.actual_behavior) && (
            <div className="mt-6 space-y-4">
              {feedback.steps_to_reproduce && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Steps to Reproduce</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{feedback.steps_to_reproduce}</p>
                </div>
              )}
              {feedback.expected_behavior && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Expected Behavior</h4>
                  <p className="text-sm text-slate-600">{feedback.expected_behavior}</p>
                </div>
              )}
              {feedback.actual_behavior && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Actual Behavior</h4>
                  <p className="text-sm text-slate-600">{feedback.actual_behavior}</p>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {feedback.attachments?.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Attachments</h4>
              <div className="flex flex-wrap gap-2">
                {feedback.attachments.map((file, i) => (
                  <a 
                    key={i}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{file.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Responses */}
        <div className="p-6">
          <h3 className="font-medium text-slate-900 mb-4">
            Responses ({responses.length})
          </h3>
          
          <div className="space-y-4 mb-6">
            {responses.map((response) => (
              <div 
                key={response.id}
                className={cn(
                  'p-4 rounded-xl',
                  response.is_official 
                    ? 'bg-blue-50 border border-blue-100' 
                    : 'bg-slate-50'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {response.is_official ? (
                    <Badge variant="primary" size="sm">
                      {workspaceName} Team
                    </Badge>
                  ) : (
                    <span className="text-sm text-slate-500">User</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {format(new Date(response.created_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {response.content}
                </p>
              </div>
            ))}
            
            {responses.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No responses yet
              </p>
            )}
          </div>

          {/* Reply form */}
          {!isStaff && sessionStorage.getItem('isPublicAccess') === 'true' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
              <p className="text-slate-600 mb-3">Login to post responses and engage with this feedback</p>
              <Button 
                onClick={() => base44.auth.redirectToLogin(window.location.href)}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Login to Respond
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={isStaff ? "Write an official response..." : "Add a comment..."}
                className="min-h-[100px]"
              />
              <div className="flex justify-between items-center">
                {isStaff && (
                  <p className="text-xs text-slate-400">
                    Your response will be labeled as "{workspaceName} Team"
                  </p>
                )}
                <Button 
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || submitting}
                  className="ml-auto bg-slate-900 hover:bg-slate-800"
                >
                  {submitting ? 'Sending...' : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isStaff ? 'Post Official Response' : 'Submit'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add to Roadmap Modal */}
      <AddToRoadmapModal
        isOpen={showAddToRoadmap}
        onClose={() => setShowAddToRoadmap(false)}
        feedback={feedback}
        workspaceId={feedback.workspace_id}
        onSuccess={onUpdate}
      />
    </div>
    </>
  );
}