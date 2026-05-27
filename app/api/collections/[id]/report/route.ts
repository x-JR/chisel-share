import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import {
  getCollection,
  insertCollectionReport,
  hasReported,
  getCollectionReportCount,
} from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAction, getClientIp } from '@/lib/logger';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_REASONS = new Set(['offensive', 'spam', 'broken_textures']);

// 10 reports per IP per 10 minutes
const REPORT_LIMIT = 10;
const REPORT_WINDOW_MS = 10 * 60_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 'report', REPORT_LIMIT, REPORT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting another report.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' && VALID_REASONS.has(body.reason)
    ? body.reason
    : 'offensive';

  const cookieStore = await cookies();
  let reporterToken = cookieStore.get('uploader_token')?.value;
  let isNewToken = false;
  if (!reporterToken || !UUID_RE.test(reporterToken)) {
    reporterToken = uuidv4();
    isNewToken = true;
  }

  // Prevent reporting your own collection
  if (collection.uploader_token && collection.uploader_token === reporterToken) {
    return NextResponse.json({ error: 'You cannot report your own collection' }, { status: 403 });
  }

  const alreadyReported = await hasReported(id, reporterToken);
  if (alreadyReported) {
    return NextResponse.json({ error: 'Already reported' }, { status: 409 });
  }

  await insertCollectionReport(id, reporterToken, reason);

  // Discord webhook notification (fire-and-forget)
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    const totalReports = await getCollectionReportCount(id);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const collectionUrl = `${baseUrl}/view/collection/${id}`;
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '⚑ Collection Reported',
          color: 0xe74c3c,
          fields: [
            { name: 'Collection', value: `[${collection.name}](${collectionUrl})`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Total Reports', value: String(totalReports), inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    }).catch(() => { /* non-fatal */ });
  }

  logAction({
    request,
    action: 'report_collection',
    resourceType: 'collection',
    resourceId: id,
    voterToken: reporterToken,
    details: { reason },
  });

  const response = NextResponse.json({ ok: true }, { status: 201 });
  if (isNewToken) {
    response.cookies.set('uploader_token', reporterToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
