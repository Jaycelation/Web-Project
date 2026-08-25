import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Đăng nhập', robots: { index: false, follow: false } };
export default function LoginPage() { return <AuthShell title="Đăng nhập" description="Theo dõi đơn hàng, địa chỉ và ưu đãi dành riêng cho bạn."><Suspense><LoginForm /></Suspense></AuthShell>; }
