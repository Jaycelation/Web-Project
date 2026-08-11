import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/reset-password-form';
export const metadata: Metadata = { title: 'Đặt lại mật khẩu', robots: { index: false, follow: false } };
export default function ResetPage() { return <AuthShell title="Đặt mật khẩu mới" description="Mật khẩu mới sẽ thu hồi toàn bộ session đăng nhập hiện tại."><Suspense><ResetPasswordForm /></Suspense></AuthShell>; }
