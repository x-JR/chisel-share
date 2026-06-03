'use client';

import { useEffect, useRef, useState } from 'react';

interface Comment {
  id: string;
  author_name: string | null;
  body: string;
  created_at: number;
}

interface Props {
  targetType: 'schematic' | 'collection';
  targetId: string;
  initialComments: Comment[];
  isAdmin: boolean;
}

declare global {
  interface Window {
    grecaptcha: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      getResponse: (widgetId: number) => string;
      reset: (widgetId: number) => void;
    };
    __recaptchaOnLoad?: () => void;
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? null;

export default function CommentsSection({ targetType, targetId, initialComments, isAdmin }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [authorName, setAuthorName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);

  const apiUrl =
    targetType === 'schematic'
      ? `/api/schematics/${targetId}/comments`
      : `/api/collections/${targetId}/comments`;

  // Load reCAPTCHA v2 widget
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;

    function renderWidget() {
      if (captchaRef.current && widgetId.current === null && window.grecaptcha?.render) {
        widgetId.current = window.grecaptcha.render(captchaRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          theme: 'dark',
        });
      }
    }

    window.__recaptchaOnLoad = renderWidget;

    // Script may already be present from a previous render
    if (!document.querySelector('script[data-recaptcha]')) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=__recaptchaOnLoad';
      script.async = true;
      script.defer = true;
      script.dataset.recaptcha = '1';
      document.head.appendChild(script);
    } else {
      // Script is already present — grecaptcha may already be available
      renderWidget();
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let recaptchaToken: string | null = null;
    if (RECAPTCHA_SITE_KEY) {
      if (widgetId.current === null) {
        setError('reCAPTCHA is not ready yet. Please wait a moment and try again.');
        return;
      }
      recaptchaToken = window.grecaptcha.getResponse(widgetId.current);
      if (!recaptchaToken) {
        setError('Please complete the reCAPTCHA before posting.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || null,
          body: body.trim(),
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to post comment.');
        if (RECAPTCHA_SITE_KEY && widgetId.current !== null) {
          window.grecaptcha.reset(widgetId.current);
        }
        return;
      }

      setComments((prev) => [...prev, data as Comment]);
      setAuthorName('');
      setBody('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      if (RECAPTCHA_SITE_KEY && widgetId.current !== null) {
        window.grecaptcha.reset(widgetId.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

  return (
    <section className="mt-10 border-t border-slate-800 pt-10">
      <h2 className="text-xl font-semibold text-slate-200 mb-6">
        Comments{comments.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({comments.length})</span>}
      </h2>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-slate-500 text-sm mb-8">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4 mb-8">
          {comments.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm font-medium">
                    {c.author_name ?? 'Anonymous'}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {new Date(c.created_at * 1000).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-slate-600 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete comment (admin)"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-slate-400 text-sm whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Post form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Leave a comment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Name (optional)</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={100}
              placeholder="Anonymous"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">
              Comment <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={2000}
              rows={4}
              placeholder="Write a comment…"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <p className="text-slate-600 text-xs mt-1 text-right">{body.length}/2000</p>
          </div>

          {RECAPTCHA_SITE_KEY && (
            <div ref={captchaRef} />
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">Comment posted!</p>}

          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      </div>
    </section>
  );
}
