'use client';

import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
  fetchOptions: { credentials: 'include' },
  plugins: [usernameClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
