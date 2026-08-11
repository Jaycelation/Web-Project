'use client';

import { useState, type FormEvent } from 'react';
import { apiErrorMessage, browserApi } from '@/lib/api';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    try {
      const result = await browserApi().request<{ message: string }>('/marketing/subscribe', { email, consent: true });
      setStatus('success');
      setMessage(result.message);
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(apiErrorMessage(error));
    }
  };

  return <div>
    <form className="newsletter-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="newsletter-email">Email nhận tin</label>
      <input id="newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@cua-ban.vn" />
      <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Đang gửi…' : 'Đăng ký'}</button>
    </form>
    {message && <p className={status === 'success' ? 'alert alert-success' : 'alert alert-error'}>{message}</p>}
  </div>;
}
