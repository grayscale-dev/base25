import { useState } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useProfileGuard } from '@/components/auth/useProfileGuard';

export default function NewThreadModal({ isOpen, onClose, workspaceId, onSuccess }) {
  const { guardAction, ProfileGuard } = useProfileGuard();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return { name: file.name, url: file_url, size: file.size };
        })
      );
      setAttachments([...attachments, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !message) return;

    setSubmitting(true);
    try {
      await guardAction(async () => {
        const user = await base44.auth.me();
        
        // Create thread
        const thread = await base44.entities.SupportThread.create({
          workspace_id: workspaceId,
          subject,
          status: 'open',
          priority: 'medium',
          requester_id: user.id,
          requester_email: user.email,
          last_message_at: new Date().toISOString(),
          message_count: 1,
        });

        // Create first message
        await base44.entities.SupportMessage.create({
          thread_id: thread.id,
          workspace_id: workspaceId,
          content: message,
          author_id: user.id,
          author_email: user.email,
          is_internal_note: false,
          is_staff_reply: false,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        setSubject('');
        setMessage('');
        setAttachments([]);
        onSuccess?.(thread);
        onClose();
      });
    } catch (error) {
      if (error.message !== 'Profile completion cancelled') {
        console.error('Failed to create thread:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ProfileGuard />
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Support Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="subject" className="text-sm font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="message" className="text-sm font-medium text-slate-700">
              Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              className="mt-1.5 min-h-[150px]"
              required
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700">Attachments</Label>
            <div className="mt-1.5">
              <label className={cn(
                'flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer',
                'hover:bg-slate-50 hover:border-slate-300 transition-colors',
                uploading && 'opacity-50 cursor-not-allowed'
              )}>
                <Paperclip className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {uploading ? 'Uploading...' : 'Click to attach files'}
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!subject || !message || submitting}
              style={{ backgroundColor: JSON.parse(sessionStorage.getItem('selectedWorkspace') || '{}').primary_color || '#0f172a' }}
              className="hover:opacity-90 text-white"
            >
              {submitting ? 'Creating...' : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}