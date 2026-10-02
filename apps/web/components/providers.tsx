'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { CollectionsProvider } from './collections-provider';
import { CartProvider } from './cart-provider';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><CartProvider><CollectionsProvider>{children}</CollectionsProvider></CartProvider></AuthProvider>;
}
