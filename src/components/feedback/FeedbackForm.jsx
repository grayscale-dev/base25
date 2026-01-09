import { useState } from 'react';
import { ChevronDown, ChevronUp, Paperclip, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useProfileGuard } from '@/components/auth/useProfileGuard';

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', emoji: '🐛' },
  { value: 'feature_request', label: 'Feature Request', emoji: '✨' },
  { value: 'improvement', label: 'Improvement', emoji: '📈' },
  { value: 'question', label: 'Question', emoji: '❓' },
];

export default function FeedbackForm({ workspaceId, onSuccess, onCancel, allowAttachments = true }) {
  const { guardAction, ProfileGuard } = useProfileGuard();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [environment, setEnvironment] = useState({ browser: '', os: '', version: '' });
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
          return { name: file.name, url: file_url, type: file.type };
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
    if (!title || !type || !description) return;

    setSubmitting(true);
    try {
      await guardAction(async () => {
        const user = await base44.auth.me();
        const feedbackData = {
          workspace_id: workspaceId,
          title,
          type,
          description,
          submitter_id: user.id,
          submitter_email: user.email,
          status: 'open',
          visibility: 'public',
          vote_count: 0,
        };

        if (stepsToReproduce) feedbackData.steps_to_reproduce = stepsToReproduce;
        if (expectedBehavior) feedbackData.expected_behavior = expectedBehavior;
        if (actualBehavior) feedbackData.actual_behavior = actualBehavior;
        if (environment.browser || environment.os || environment.version) {
          feedbackData.environment = environment;
        }
        if (attachments.length > 0) feedbackData.attachments = attachments;

        await base44.entities.Feedback.create(feedbackData);
        onSuccess?.();
      });
    } catch (error) {
      if (error.message !== 'Profile completion cancelled') {
        console.error('Failed to submit feedback:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ProfileGuard />
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title" className="text-sm font-medium text-slate-700">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of your feedback"
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <Label htmlFor="type" className="text-sm font-medium text-slate-700">
            Type <span className="text-red-500">*</span>
          </Label>
          <Select value={type} onValueChange={setType} required>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select feedback type" />
            </SelectTrigger>
            <SelectContent>
              {feedbackTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium text-slate-700">
            Description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your feedback in detail..."
            className="mt-1.5 min-h-[120px]"
            required
          />
        </div>
      </div>

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full justify-between text-slate-600 hover:bg-slate-50"
          >
            <span className="text-sm">Provide more details (optional)</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {type === 'bug' && (
            <>
              <div>
                <Label className="text-sm font-medium text-slate-700">Steps to Reproduce</Label>
                <Textarea
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Expected Behavior</Label>
                  <Textarea
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="What should happen?"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Actual Behavior</Label>
                  <Textarea
                    value={actualBehavior}
                    onChange={(e) => setActualBehavior(e.target.value)}
                    placeholder="What actually happens?"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-sm font-medium text-slate-700">Environment</Label>
            <div className="grid grid-cols-3 gap-3 mt-1.5">
              <Input
                placeholder="Browser"
                value={environment.browser}
                onChange={(e) => setEnvironment({ ...environment, browser: e.target.value })}
              />
              <Input
                placeholder="OS"
                value={environment.os}
                onChange={(e) => setEnvironment({ ...environment, os: e.target.value })}
              />
              <Input
                placeholder="App Version"
                value={environment.version}
                onChange={(e) => setEnvironment({ ...environment, version: e.target.value })}
              />
            </div>
          </div>

          {allowAttachments && (
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
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={!title || !type || !description || submitting}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {submitting ? (
            'Submitting...'
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
    </>
  );
}