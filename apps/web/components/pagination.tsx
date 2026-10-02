'use client';
export function Pagination({ page, pageSize, total, onChange, disabled = false }: {
  page: number; pageSize: number; total: number; onChange: (page: number) => void; disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && page <= 1) return null;
  return <nav className="pagination" aria-label="Phân trang">
    <button type="button" disabled={disabled || page <= 1} onClick={() => onChange(1)} aria-label="Trang đầu">«</button>
    <button type="button" disabled={disabled || page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>Trước</button>
    <span aria-live="polite">Trang {page} / {pages} · {total} kết quả</span>
    <button type="button" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Sau</button>
    <button type="button" disabled={disabled || page >= pages} onClick={() => onChange(pages)} aria-label="Trang cuối">»</button>
  </nav>;
}
