import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ReactQuill from 'react-quill';
import { base44 } from '@/api/base44Client';

export default function DocEditor({ doc, onSave }) {
  const [content, setContent] = useState(doc?.content || '');
  const [contentType, setContentType] = useState(doc?.content_type || 'markdown');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(doc?.content || '');
    setContentType(doc?.content_type || 'markdown');
  }, [doc]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.DocPage.update(doc.id, {
        content,
        content_type: contentType
      });
      onSave();
    } catch (error) {
      console.error('Failed to save doc:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>Editor Mode</Label>
          <Select value={contentType} onValueChange={setContentType}>
            <SelectTrigger className="mt-1.5 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="html">WYSIWYG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: JSON.parse(sessionStorage.getItem('selectedBoard') || '{}').primary_color || '#0f172a' }}
          className="hover:opacity-90 text-white mt-6"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {contentType === 'markdown' ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="# Getting Started&#10;&#10;Write your documentation in Markdown..."
          className="min-h-[500px] font-mono"
        />
      ) : (
        <div className="border border-slate-200 rounded-lg">
          <ReactQuill
            value={content}
            onChange={setContent}
            theme="snow"
            className="min-h-[500px]"
          />
        </div>
      )}
    </div>
  );
}