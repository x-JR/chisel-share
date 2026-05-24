import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import {
  getCollection,
  getCollectionLikeCount,
  hasLikedCollection,
  toggleCollectionLike,
} from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const voterToken = cookieStore.get('uploader_token')?.value;

  const count = await getCollectionLikeCount(id);
  const liked = voterToken ? await hasLikedCollection(id, voterToken) : false;

  return NextResponse.json({ liked, count });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let voterToken = cookieStore.get('uploader_token')?.value;
  let newToken = false;

  if (!voterToken) {
    voterToken = uuidv4();
    newToken = true;
  }

  const liked = await toggleCollectionLike(id, voterToken);
  const count = await getCollectionLikeCount(id);

  const response = NextResponse.json({ liked, count });

  if (newToken) {
    response.cookies.set('uploader_token', voterToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
