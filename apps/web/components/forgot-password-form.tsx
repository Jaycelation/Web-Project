'use client';

import { useState, type FormEvent } from 'react';
import { apiErrorMessage, browserRequest } from '@/lib/api';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setLoading(true); setError(''); const data = new FormData(event.currentTarget); try { const result = await browserRequest<{ message: string }>('/auth/forgot-password', { email: String(data.get('email')) }); setMessage(result.message); } catch (requestError) { setError(apiErrorMessage(requestError)); } finally { setLoading(false); } };
  return <form onSubmit={submit}><div className="form-field"><label htmlFor="email">Email tài khoản</label><input id="email" name="email" type="email" required autoComplete="email" /></div>{message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-error">{error}</div>}<button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? 'Đang gửi…' : 'Gửi hướng dẫn đặt lại'}</button></form>;
}
