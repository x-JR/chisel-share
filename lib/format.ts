/** Formats a Unix timestamp (seconds) as a short date, e.g. "Jan 5, 2025". */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Formats a count compactly for display in tight UI spaces, e.g. 1234 -> "1.2K". */
export function formatCompactCount(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
}
