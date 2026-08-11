import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
export const metadata: Metadata = { title: 'Quên mật khẩu', robots: { index: false, follow: false } };
export default function ForgotPage() { return <AuthShell title="Khôi phục mật khẩu" description="Nhập email để nhận liên kết đặt lại có hiệu lực trong 30 phút."><ForgotPasswordForm /></AuthShell>; }
