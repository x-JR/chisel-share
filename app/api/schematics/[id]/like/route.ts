import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { getSchematic, getLikeCount, hasLiked, toggleLike } from '@/lib/db';
import { logAction } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const voterToken = cookieStore.get('uploader_token')?.value;

  const count = await getLikeCount(id);
  const liked = voterToken ? await hasLiked(id, voterToken) : false;

  return NextResponse.json({ liked, count });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getSchematic(id);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let voterToken = cookieStore.get('uploader_token')?.value;
  let newToken = false;

  if (!voterToken) {
    voterToken = uuidv4();
    newToken = true;
  }

  const liked = await toggleLike(id, voterToken);
  const count = await getLikeCount(id);

  logAction({
    request,
    action: liked ? 'like' : 'unlike',
    resourceType: 'schematic',
    resourceId: id,
    voterToken,
  });

  const response = NextResponse.json({ liked, count });

  if (newToken) {
    response.cookies.set('uploader_token', voterToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return response;
}
