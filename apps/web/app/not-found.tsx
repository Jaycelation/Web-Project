import Link from 'next/link';
export default function NotFound() { return <div className="not-found"><div><strong>404</strong><h1>Không tìm thấy trang</h1><p>Đường dẫn có thể đã thay đổi hoặc nội dung không còn khả dụng.</p><Link className="button button-primary" href="/">Về trang chủ</Link></div></div>; }
