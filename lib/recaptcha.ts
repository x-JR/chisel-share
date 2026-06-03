/**
 * Verifies a reCAPTCHA v2 response token via Google's siteverify API.
 *
 * If RECAPTCHA_SECRET_KEY is not set, verification is skipped and the function
 * always returns true (reCAPTCHA is considered disabled/optional).
 */
export async function verifyRecaptcha(token: string | null | undefined): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return true; // reCAPTCHA not configured — allow through

  if (!token) return false;

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }).toString(),
  });

  if (!res.ok) return false;

  const data: { success: boolean } = await res.json();
  return data.success === true;
}
