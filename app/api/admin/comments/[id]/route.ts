import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getComment, deleteComment } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || uploaderToken !== adminToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const comment = await getComment(id);
  if (!comment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await deleteComment(id);
  return NextResponse.json({ ok: true });
}
