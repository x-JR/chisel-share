import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

/** Replace the current uploader_token cookie with a caller-supplied or freshly-generated token. */
export async function POST(request: NextRequest) {
  let token: string | undefined;

  try {
    const body = await request.json();
    if (typeof body.token === 'string') {
      token = body.token.trim();
    }
  } catch {
    // no body — generate a fresh token
  }

  if (token !== undefined && !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  if (!token) {
    token = uuidv4();
  }

  const cookieStore = await cookies();
  cookieStore.set('uploader_token', token, COOKIE_OPTIONS);

  return NextResponse.json({ token });
}
