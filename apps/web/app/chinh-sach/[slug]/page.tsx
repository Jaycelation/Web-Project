import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const fallbackPages: Record<string, { title: string; content: string }> = {
  'chinh-sach-giao-hang': { title: 'Chính sách giao hàng', content: 'Phạm vi giao hàng\n\nSecure Commerce giao hàng trên toàn quốc. Phí vận chuyển được tính theo cấu hình khu vực và giá trị đơn.\n\nThời gian xử lý\n\nĐơn được xác nhận trước khi chuyển sang chuẩn bị hàng. Mã vận đơn được cập nhật khi đơn chuyển sang trạng thái đang giao.\n\nLưu ý\n\nNội dung mẫu cần được rà soát theo quy trình vận hành thực tế trước khi mở bán.' },
  'chinh-sach-doi-tra': { title: 'Chính sách đổi trả', content: 'Điều kiện đổi trả\n\nKhách hàng có thể gửi yêu cầu đổi trả cho đơn đã giao. Sản phẩm cần đáp ứng điều kiện về thời hạn, tình trạng và chứng từ mua hàng.\n\nQuy trình\n\nYêu cầu được gắn trực tiếp với đơn hàng để bộ phận vận hành xác minh, phê duyệt và xử lý hoàn tiền khi phù hợp.' },
  'chinh-sach-bao-mat': { title: 'Chính sách bảo mật', content: 'Dữ liệu tài khoản\n\nMật khẩu được băm; access token và refresh token được quản lý theo session. Dữ liệu thẻ không được lưu trực tiếp trong MVP.\n\nBảo vệ truyền tải\n\nHTTPS là bắt buộc ở production. Lớp envelope RSA‑OAEP + AES‑256‑GCM chỉ là kiểm soát bổ sung, không thay thế TLS.\n\nNhật ký\n\nCác thao tác quản trị quan trọng được ghi audit log để phục vụ đối soát.' },
  'dieu-khoan-su-dung': { title: 'Điều khoản sử dụng', content: 'Phạm vi sử dụng\n\nWebsite cung cấp chức năng khám phá sản phẩm, giỏ hàng, đặt hàng và quản lý đơn.\n\nTrách nhiệm người dùng\n\nNgười dùng cần cung cấp thông tin nhận hàng chính xác, giữ bí mật thông tin đăng nhập và không lạm dụng hệ thống.\n\nLưu ý pháp lý\n\nĐây là nội dung mẫu của bản MVP và cần được tư vấn, rà soát trước khi vận hành thương mại.' },
};

type Props = { params: Promise<{ slug: string }> };
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fallback = fallbackPages[slug];
  return { title: fallback?.title ?? 'Chính sách', description: fallback ? `Thông tin ${fallback.title.toLowerCase()} của Secure Commerce.` : undefined };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  let page: { slug: string; title: string; content: string; updatedAt: string } | undefined;
  try { page = await serverApi().request('/content/page', { slug }); } catch { const fallback = fallbackPages[slug]; if (fallback) page = { slug, ...fallback, updatedAt: new Date('2026-08-11T00:00:00+07:00').toISOString() }; }
  if (!page) notFound();
  return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>{page.title}</strong></div></div></section><section className="section"><div className="container"><article className="policy-content"><h1>{page.title}</h1><p className="updated">Cập nhật: {formatDateTime(page.updatedAt)}</p><div className="policy-body">{page.content}</div></article></div></section></>;
}
