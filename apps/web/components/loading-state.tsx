export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" /><p>{label}</p></div>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><div className="empty-orbit" /><h2>{title}</h2><p>{message}</p></div>;
}
