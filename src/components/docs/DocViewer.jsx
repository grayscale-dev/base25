import { useState, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import LinksPanel from '@/components/common/LinksPanel';

export default function DocViewer({ doc, onRefresh, isStaff }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadComments();
    loadUser();
  }, [doc?.id]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadComments = async () => {
    if (!doc?.id) return;
    try {
      const workspaceId = sessionStorage.getItem('selectedWorkspaceId');
      const docComments = await base44.entities.DocComment.filter(
        { workspace_id: workspaceId, doc_page_id: doc.id },
        'created_date'
      );
      setComments(docComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;

    setPosting(true);
    try {
      const workspaceId = sessionStorage.getItem('selectedWorkspaceId');
      await base44.entities.DocComment.create({
        workspace_id: workspaceId,
        doc_page_id: doc.id,
        content: newComment,
        author_id: user.id,
        author_email: user.email,
        is_question: true,
        is_answered: false
      });

      setNewComment('');
      loadComments();
      onRefresh();
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Content */}
      <div className="prose prose-slate max-w-none">
        {doc.content_type === 'markdown' ? (
          <ReactMarkdown>{doc.content || ''}</ReactMarkdown>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: doc.content || '' }} />
        )}
      </div>

      {/* Links Panel */}
      <div className="mt-6">
        <LinksPanel
          workspaceId={doc.workspace_id}
          itemType="docs"
          itemId={doc.id}
          links={{
            feedback_ids: doc.feedback_ids || [],
            roadmap_item_ids: doc.roadmap_item_ids || [],
            changelog_entry_ids: doc.changelog_entry_ids || [],
            support_thread_ids: doc.support_thread_ids || []
          }}
          onUpdate={onRefresh}
          isStaff={isStaff}
        />
      </div>

      {/* Comments */}
      <div className="border-t border-slate-200 pt-8">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Questions & Comments</h3>
          <span className="text-sm text-slate-500">({comments.length})</span>
        </div>

        <div className="space-y-4 mb-6">
          {comments.map(comment => (
            <div key={comment.id} className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {comment.author_email}
                  </span>
                  {comment.is_answered && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Answered
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {format(new Date(comment.created_date), 'MMM d, yyyy')}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>

        {/* New Comment Form */}
        <div className="space-y-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ask a question or leave a comment..."
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handlePostComment}
              disabled={!newComment.trim() || posting}
              style={{ backgroundColor: JSON.parse(sessionStorage.getItem('selectedWorkspace') || '{}').primary_color || '#0f172a' }}
              className="hover:opacity-90 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              {posting ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}