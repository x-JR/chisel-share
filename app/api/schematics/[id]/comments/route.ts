import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSchematic, getComments, insertComment } from '@/lib/db';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_LEN = 2000;
const MAX_AUTHOR_LEN = 100;
const COMMENT_LIMIT = 5;
const COMMENT_WINDOW_MS = 10 * 60_000; // 5 per 10 minutes per IP

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const comments = await getComments('schematic', id);
  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 'comment', COMMENT_LIMIT, COMMENT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many comments. Please wait before posting again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const schematic = await getSchematic(id);
  if (!schematic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { author_name?: string | null; body?: string; recaptcha_token?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const commentBody = (body.body ?? '').trim();
  if (!commentBody) {
    return NextResponse.json({ error: 'Comment body is required.' }, { status: 400 });
  }
  if (commentBody.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `Comment must be at most ${MAX_BODY_LEN} characters.` }, { status: 400 });
  }

  const authorName = body.author_name
    ? body.author_name.trim().slice(0, MAX_AUTHOR_LEN) || null
    : null;

  const captchaOk = await verifyRecaptcha(body.recaptcha_token);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'reCAPTCHA verification failed. Please try again.' },
      { status: 400 }
    );
  }

  const comment = {
    id: uuidv4(),
    target_type: 'schematic',
    target_id: id,
    author_name: authorName,
    body: commentBody,
    created_at: Math.floor(Date.now() / 1000),
  };

  await insertComment(comment);
  return NextResponse.json(comment, { status: 201 });
}
