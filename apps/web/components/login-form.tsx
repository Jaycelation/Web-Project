'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from './auth-provider';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true); setError('');
    try {
      await login(String(data.get('email')), String(data.get('password')));
      const next = searchParams.get('next');
      router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/tai-khoan');
    } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); }
  };

  return <><form onSubmit={submit}><div className="form-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="customer@securecommerce.local" /></div><div className="form-field"><label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div><div className="auth-links"><label><input type="checkbox" /> Ghi nhớ trên thiết bị này</label><Link href="/quen-mat-khau">Quên mật khẩu?</Link></div>{error && <div className="alert alert-error">{error}</div>}<button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? 'Đang xác thực…' : 'Đăng nhập'}</button></form><p className="auth-switch">Chưa có tài khoản? <Link href="/dang-ky">Đăng ký miễn phí</Link></p></>;
}
