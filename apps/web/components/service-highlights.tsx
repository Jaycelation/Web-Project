import { HeadsetIcon, RefreshIcon, SparkleIcon, TruckIcon } from './icons';

export function ServiceHighlights() {
  return <section className="service-highlights container" aria-label="Quyền lợi mua sắm">
    <div><SparkleIcon /><span><strong>Sản phẩm chính hãng</strong><small>Thông tin và nguồn gốc rõ ràng</small></span></div>
    <div><TruckIcon /><span><strong>Miễn phí vận chuyển</strong><small>Cho đơn hàng từ 1.000.000 ₫</small></span></div>
    <div><RefreshIcon /><span><strong>Đổi trả dễ dàng</strong><small>Trong vòng 7 ngày</small></span></div>
    <div><HeadsetIcon /><span><strong>Hỗ trợ tận tâm</strong><small>Thứ Hai – Thứ Bảy</small></span></div>
  </section>;
}
