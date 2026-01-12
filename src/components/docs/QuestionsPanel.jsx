import { useState, useEffect } from 'react';
import { X, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function QuestionsPanel({ workspaceId, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState({});

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const allComments = await base44.entities.DocComment.filter(
        { board_id: workspaceId, is_question: true },
        '-created_date'
      );
      setQuestions(allComments);

      // Load doc titles
      const docIds = [...new Set(allComments.map(c => c.doc_page_id).filter(Boolean))];
      const docData = {};
      for (const id of docIds) {
        const results = await base44.entities.DocPage.filter({ id });
        if (results[0]) {
          docData[id] = results[0];
        }
      }
      setDocs(docData);
    } catch (error) {
      console.error('Failed to load questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAnswered = async (question) => {
    try {
      await base44.entities.DocComment.update(question.id, {
        is_answered: !question.is_answered
      });
      loadQuestions();
    } catch (error) {
      console.error('Failed to update question:', error);
    }
  };

  const unanswered = questions.filter(q => !q.is_answered);
  const answered = questions.filter(q => q.is_answered);

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Customer Questions</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Unanswered */}
        {unanswered.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              Unanswered ({unanswered.length})
            </h4>
            <div className="space-y-3">
              {unanswered.map(q => (
                <div key={q.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-600">
                          {docs[q.doc_page_id]?.title || 'Unknown Doc'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-900 font-medium">{q.author_email}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {format(new Date(q.created_date), 'MMM d')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">{q.content}</p>
                  <Button
                    onClick={() => handleMarkAnswered(q)}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <CheckCircle className="h-3 w-3 mr-2" />
                    Mark as Answered
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answered */}
        {answered.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              Answered ({answered.length})
            </h4>
            <div className="space-y-3">
              {answered.map(q => (
                <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-600">
                          {docs[q.doc_page_id]?.title || 'Unknown Doc'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{q.author_email}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm text-slate-600">{q.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {questions.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">No questions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
