'use client';

import { useRouter } from 'next/navigation';

interface Comment {
  id: string;
  author_name: string | null;
  body: string;
  created_at: number;
}

interface Props {
  comments: Comment[];
  isAdmin: boolean;
  targetId: string;
}

export default function CommentsListPanel({ comments, isAdmin, targetId }: Props) {
  const router = useRouter();

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <h2 className="text-slate-300 font-semibold mb-3">
        Comments
        {comments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-slate-500">({comments.length})</span>
        )}
      </h2>

      {comments.length === 0 ? (
        <p className="text-slate-500 text-sm">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-96 pr-1">
          {comments.map((c) => (
            <div key={c.id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 group">
              <div className="flex items-center justify-between mb-1.5">
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
    </div>
  );
}
