import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/reset-password-form';
export const metadata: Metadata = { title: 'Đặt lại mật khẩu', robots: { index: false, follow: false } };
export default function ResetPage() { return <AuthShell title="Đặt mật khẩu mới" description="Chọn mật khẩu mới để tiếp tục sử dụng tài khoản MIRA."><Suspense><ResetPasswordForm /></Suspense></AuthShell>; }
