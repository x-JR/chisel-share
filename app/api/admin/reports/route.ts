import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getReportedCollections } from '@/lib/db';

export async function GET(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  if (uploaderToken !== adminToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const collections = await getReportedCollections();
  return NextResponse.json(collections);
}
