import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Paperclip, X, User, Shield, Clock, Lock, UserPlus } from 'lucide-react';
import LinksPanel from '@/components/common/LinksPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_user', label: 'Awaiting User' },
  { value: 'awaiting_support', label: 'Awaiting Support' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function SupportThreadDetail({ 
  thread, 
  messages, 
  isStaff, 
  workspaceName,
  currentUserId,
  onBack, 
  onUpdate 
}) {
  const [messageContent, setMessageContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(thread.status);
  const [priority, setPriority] = useState(thread.priority || 'medium');
  const [participants, setParticipants] = useState(thread.participants || []);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantEmail, setParticipantEmail] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;

    setSending(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.SupportMessage.create({
        thread_id: thread.id,
        workspace_id: thread.workspace_id,
        content: messageContent,
        author_id: user.id,
        author_email: user.email,
        is_internal_note: isStaff && isInternalNote,
        is_staff_reply: isStaff,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Update thread
      await base44.entities.SupportThread.update(thread.id, {
        last_message_at: new Date().toISOString(),
        message_count: (thread.message_count || 0) + 1,
        status: isStaff ? (isInternalNote ? status : 'awaiting_user') : 'awaiting_support',
      });

      setMessageContent('');
      setAttachments([]);
      setIsInternalNote(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await base44.entities.SupportThread.update(thread.id, { status: newStatus });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    setPriority(newPriority);
    try {
      await base44.entities.SupportThread.update(thread.id, { priority: newPriority });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
  };

  const handleAddParticipant = async () => {
    if (!participantEmail.trim()) return;
    
    try {
      const roles = await base44.entities.WorkspaceRole.filter({ 
        workspace_id: thread.workspace_id, 
        email: participantEmail 
      });
      
      if (roles.length === 0) {
        alert('User not found in workspace');
        return;
      }
      
      const userId = roles[0].user_id;
      const newParticipants = [...new Set([...participants, userId])];
      
      await base44.entities.SupportThread.update(thread.id, { 
        participants: newParticipants 
      });
      
      setParticipants(newParticipants);
      setParticipantEmail('');
      setShowAddParticipant(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add participant:', error);
    }
  };

  // Filter internal notes for non-staff
  const visibleMessages = isStaff 
    ? messages 
    : messages.filter(m => !m.is_internal_note);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={onBack} className="text-slate-600 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{thread.subject}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <span>#{thread.id.slice(0, 8)}</span>
              <span>•</span>
              <span>{format(new Date(thread.created_date), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
        
        {isStaff && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddParticipant(!showAddParticipant)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Participant
            </Button>
            <Select value={priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Add Participant Form */}
      {showAddParticipant && isStaff && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg mb-6">
          <Input
            value={participantEmail}
            onChange={(e) => setParticipantEmail(e.target.value)}
            placeholder="Enter user email..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
          />
          <Button onClick={handleAddParticipant} size="sm">
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAddParticipant(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Links Panel */}
      {isStaff && (
        <div className="mb-6">
          <LinksPanel
            workspaceId={thread.workspace_id}
            itemType="support"
            itemId={thread.id}
            links={{
              feedback_ids: thread.feedback_ids || [],
              roadmap_item_ids: thread.roadmap_item_ids || [],
              changelog_entry_ids: thread.changelog_entry_ids || [],
              doc_page_ids: thread.doc_page_ids || []
            }}
            onUpdate={onUpdate}
            isStaff={isStaff}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 p-4 bg-slate-50 rounded-2xl">
        {visibleMessages.map((message) => {
          const isOwnMessage = message.author_id === currentUserId;
          const isInternal = message.is_internal_note;

          return (
            <div
              key={message.id}
              className={cn(
                'flex',
                isOwnMessage ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={cn(
                'max-w-[80%] rounded-2xl p-4',
                isInternal 
                  ? 'bg-amber-50 border border-amber-200' 
                  : isOwnMessage 
                    ? 'bg-slate-900 text-white' 
                    : message.is_staff_reply
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-white border border-slate-200'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {isInternal && (
                    <Badge variant="warning" size="sm" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Internal Note
                    </Badge>
                  )}
                  {!isInternal && message.is_staff_reply && (
                    <Badge variant="primary" size="sm" className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {workspaceName} Team
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    {format(new Date(message.created_date), 'MMM d, h:mm a')}
                  </span>
                </div>
                
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {message.content}
                </p>
                
                {message.attachments?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {message.attachments.map((file, i) => (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm underline text-blue-600"
                      >
                        <Paperclip className="h-3 w-3" />
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply form */}
      {(status !== 'closed') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {isStaff && (
            <div className="flex items-center gap-2 mb-3">
              <Checkbox 
                id="internal" 
                checked={isInternalNote}
                onCheckedChange={setIsInternalNote}
              />
              <label htmlFor="internal" className="text-sm text-slate-600 cursor-pointer">
                Internal note (only visible to staff)
              </label>
            </div>
          )}
          
          <Textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder={isInternalNote ? "Add an internal note..." : "Type your message..."}
            className={cn(
              "min-h-[100px] mb-3",
              isInternalNote && "border-amber-200 bg-amber-50/50"
            )}
          />
          
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((file, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg"
                >
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="text-sm text-slate-600">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    className="h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
              'hover:bg-slate-100',
              uploading && 'opacity-50 cursor-not-allowed'
            )}>
              <Paperclip className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-600">
                {uploading ? 'Uploading...' : 'Attach files'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            
            <Button 
              onClick={handleSendMessage}
              disabled={!messageContent.trim() || sending}
              className={cn(
                isInternalNote 
                  ? 'bg-amber-500 hover:bg-amber-600' 
                  : 'bg-slate-900 hover:bg-slate-800'
              )}
            >
              {sending ? 'Sending...' : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {isInternalNote ? 'Add Note' : 'Send'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}