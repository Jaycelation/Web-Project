import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { RegisterForm } from '@/components/register-form';
export const metadata: Metadata = { title: 'Đăng ký', robots: { index: false, follow: false } };
export default function RegisterPage() { return <AuthShell title="Tạo tài khoản" description="Lưu giỏ hàng, địa chỉ và theo dõi lịch sử mua sắm."><RegisterForm /></AuthShell>; }
