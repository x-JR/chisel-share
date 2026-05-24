import { cookies } from 'next/headers';
import TokenManagerClient from './TokenManagerClient';

export default async function TokenManager() {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get('uploader_token')?.value ?? null;
  return <TokenManagerClient currentToken={currentToken} />;
}
