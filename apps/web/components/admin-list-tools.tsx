'use client';
import { useState, type FormEvent } from 'react';
export function AdminSearch({ onSearch, placeholder = 'Tìm kiếm…' }: { onSearch: (query: string) => void; placeholder?: string }) {
  const [draft,setDraft] = useState('');
  return <form className="admin-search" role="search" onSubmit={(event: FormEvent) => { event.preventDefault(); onSearch(draft.trim()); }}>
    <input maxLength={120} aria-label={placeholder} placeholder={placeholder} value={draft} onChange={(event) => setDraft(event.target.value)} />
    <button className="button button-outline button-sm" type="submit">Tìm</button>
  </form>;
}
export function ResourceStatus({ error, loading, retry }: { error: string; loading: boolean; retry: () => void }) {
  return <>{loading && <p role="status">Đang tải dữ liệu…</p>}{error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-button" onClick={retry}>Thử lại</button></div>}</>;
}
