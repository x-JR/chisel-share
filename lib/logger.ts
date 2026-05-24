import { NextRequest } from 'next/server';
import { insertLog } from './db';

/**
 * Extract the most-specific client IP available, respecting common proxy headers.
 * Truncated to 45 chars to fit the DB column (covers IPv6).
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 45);
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim().slice(0, 45);
  return 'unknown';
}

export interface LogParams {
  request: NextRequest;
  action: string;
  resourceType?: 'schematic' | 'collection';
  resourceId?: string;
  voterToken?: string;
  status?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget action logger. Never throws — logging failures must not
 * break the primary request path.
 */
export function logAction(params: LogParams): void {
  const {
    request,
    action,
    resourceType,
    resourceId,
    voterToken,
    status = 'success',
    details,
  } = params;

  insertLog({
    timestamp: Math.floor(Date.now() / 1000),
    ip: getClientIp(request),
    user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    action,
    resource_type: resourceType ?? null,
    resource_id: resourceId ?? null,
    voter_token: voterToken ?? null,
    status,
    details: details ? JSON.stringify(details) : null,
  }).catch(() => {});
}
