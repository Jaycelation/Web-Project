'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { CartProvider } from './cart-provider';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>;
}
