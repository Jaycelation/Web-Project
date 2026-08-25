'use client';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="not-found"><div><strong>!</strong><h1>Trang chưa tải được</h1><p>Kết nối có thể đang gián đoạn. Bạn vui lòng thử lại sau ít phút.</p><button className="button button-primary" type="button" onClick={reset}>Thử lại</button></div></div>; }
