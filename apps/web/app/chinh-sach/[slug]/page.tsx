import { SecureApiError } from '@secure-commerce/crypto-envelope';
import { isDemoCatalogEnabled } from '@/lib/demo';
import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const policyPages: Record<string, { title: string; content: string }> = {
  'chinh-sach-giao-hang': {
    title: 'Chính sách giao hàng',
    content: 'Phạm vi giao hàng\n\nMIRA hỗ trợ giao hàng trên toàn quốc. Phí vận chuyển được hiển thị trong giỏ hàng và có thể thay đổi theo khu vực, kích thước kiện hàng hoặc chương trình ưu đãi.\n\nThời gian xử lý\n\nĐơn hàng được xác nhận trước khi chuyển sang chuẩn bị. Khi kiện hàng được bàn giao cho đơn vị vận chuyển, trạng thái và mã theo dõi sẽ được cập nhật để bạn tra cứu.\n\nNhận hàng\n\nVui lòng kiểm tra tình trạng bên ngoài của kiện hàng và liên hệ bộ phận chăm sóc khách hàng nếu phát hiện dấu hiệu hư hỏng hoặc giao nhầm.',
  },
  'chinh-sach-doi-tra': {
    title: 'Chính sách đổi trả',
    content: 'Thời hạn yêu cầu\n\nBạn có thể gửi yêu cầu đổi trả trong vòng 7 ngày kể từ khi đơn hàng được ghi nhận đã giao.\n\nĐiều kiện áp dụng\n\nSản phẩm cần còn đầy đủ phụ kiện, quà tặng và chứng từ mua hàng. MIRA tiếp nhận các trường hợp sản phẩm lỗi, hư hỏng khi giao hoặc không đúng với đơn đã đặt.\n\nQuy trình xử lý\n\nGửi yêu cầu từ trang đơn hàng hoặc liên hệ bộ phận chăm sóc khách hàng. Sau khi kiểm tra điều kiện, MIRA sẽ hướng dẫn gửi lại sản phẩm và thông báo phương án đổi hoặc hoàn tiền phù hợp.',
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách quyền riêng tư',
    content: 'Thông tin MIRA thu thập\n\nMIRA có thể thu thập thông tin tài khoản, liên hệ, địa chỉ nhận hàng, nội dung đơn hàng và lịch sử hỗ trợ khi bạn sử dụng dịch vụ.\n\nMục đích sử dụng\n\nThông tin được dùng để xử lý đơn, giao hàng, chăm sóc khách hàng, cải thiện trải nghiệm và gửi nội dung tiếp thị khi bạn đồng ý.\n\nChia sẻ thông tin\n\nMIRA chỉ chia sẻ dữ liệu cần thiết với đối tác phục vụ đơn hàng, chẳng hạn đơn vị vận chuyển hoặc thanh toán, và theo yêu cầu hợp pháp của cơ quan có thẩm quyền.\n\nQuyền của bạn\n\nBạn có thể xem, cập nhật thông tin tài khoản hoặc liên hệ bộ phận chăm sóc khách hàng để yêu cầu hỗ trợ về dữ liệu cá nhân.',
  },
  'dieu-khoan-su-dung': {
    title: 'Điều khoản sử dụng',
    content: 'Sử dụng dịch vụ\n\nBạn đồng ý cung cấp thông tin đặt hàng chính xác, sử dụng website cho mục đích hợp pháp và chịu trách nhiệm bảo quản thông tin đăng nhập của mình.\n\nThông tin sản phẩm\n\nMIRA nỗ lực trình bày chính xác hình ảnh, mô tả, giá và tình trạng hàng. Một số khác biệt nhỏ về màu sắc có thể xuất hiện do thiết bị hiển thị.\n\nĐơn hàng\n\nĐơn hàng chỉ được xác nhận sau khi MIRA kiểm tra khả năng cung ứng và thông tin nhận hàng. MIRA sẽ thông báo nếu cần điều chỉnh hoặc không thể tiếp tục xử lý đơn.\n\nHỗ trợ\n\nNếu có thắc mắc về mua hàng, giao nhận hoặc đổi trả, vui lòng liên hệ bộ phận chăm sóc khách hàng để được hướng dẫn.',
  },
};

type Props = { params: Promise<{ slug: string }> };
interface Policy {slug:string; title:string; content:string; updatedAt:string; seoTitle?:string|null; seoDescription?:string|null; demo?:boolean}
export const dynamic = 'force-dynamic';
const loadPolicy = cache(async (slug: string): Promise<Policy> => {
  try { return await serverApi().request<Policy, {slug:string}>('/content/page', {slug}); }
  catch (error) {
    // A deliberate unpublish (404) must never revive the bundled policy text.
    if (error instanceof SecureApiError && error.status === 404) notFound();
    const fallback = isDemoCatalogEnabled() ? policyPages[slug] : undefined;
    if (!fallback) throw error;
    return {slug, ...fallback, updatedAt: '2026-08-25T00:00:00+07:00', demo:true};
  }
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadPolicy((await params).slug);
  return {title:page.seoTitle || page.title, description:page.seoDescription || page.content.slice(0,160)};
}
export default async function PolicyPage({ params }: Props) {
  const page = await loadPolicy((await params).slug);
  return <><section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>{page.title}</strong></div></div></section>
    <section className="section"><div className="container"><article className="policy-content"><h1>{page.title}</h1>
      {page.demo && <p className="alert" role="status">Nội dung minh họa (demo), chưa phải chính sách được công bố.</p>}
      <p className="updated">Cập nhật: {formatDateTime(page.updatedAt)}</p><div className="policy-body">{page.content}</div>
    </article></div></section></>;
}
