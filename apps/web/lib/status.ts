import type { OrderStatus, PaymentStatus } from '@secure-commerce/contracts';

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  RETURN_REQUESTED: 'Yêu cầu đổi trả',
  REFUNDED: 'Đã hoàn tiền',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: 'Chờ thanh toán',
  AWAITING_TRANSFER: 'Chờ chuyển khoản',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
};
