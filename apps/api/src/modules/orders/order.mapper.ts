import type { Prisma } from '@prisma/client';
import type { OrderDto, ShippingAddressInput } from '@secure-commerce/contracts';

export const orderInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { name: true } } },
  },
  shipment: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function mapOrder(order: OrderWithDetails): OrderDto {
  return {
    orderId: order.id,
    orderNo: order.orderNo,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingFee: order.shippingFee,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    paymentMethod: order.paymentMethod,
    customerNote: order.customerNote,
    cancellationReason: order.cancellationReason,
    shippingAddress: normalizeAddress(order.shippingAddress),
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    statusHistory: order.statusHistory.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      note: item.note,
      actorName: item.actor?.name ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    trackingCode: order.shipment?.trackingCode ?? null,
    trackingUrl: order.shipment?.trackingUrl ?? null,
  };
}

function normalizeAddress(value: Prisma.JsonValue): ShippingAddressInput {
  const record = value && !Array.isArray(value) && typeof value === 'object' ? value : {};
  return {
    fullName: stringValue(record, 'fullName'),
    phone: stringValue(record, 'phone'),
    email: stringValue(record, 'email'),
    line1: stringValue(record, 'line1'),
    ...(optionalString(record, 'line2') ? { line2: optionalString(record, 'line2') } : {}),
    ...(optionalString(record, 'ward') ? { ward: optionalString(record, 'ward') } : {}),
    district: stringValue(record, 'district'),
    province: stringValue(record, 'province'),
    ...(optionalString(record, 'postalCode') ? { postalCode: optionalString(record, 'postalCode') } : {}),
    country: optionalString(record, 'country') ?? 'VN',
  };
}

function stringValue(record: Record<string, Prisma.JsonValue>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function optionalString(record: Record<string, Prisma.JsonValue>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value ? value : undefined;
}
