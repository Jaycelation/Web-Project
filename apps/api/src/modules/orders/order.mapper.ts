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
  const record: Prisma.JsonObject = value && !Array.isArray(value) && typeof value === 'object' ? value : {};
  const line2 = optionalString(record, 'line2');
  const ward = optionalString(record, 'ward');
  const postalCode = optionalString(record, 'postalCode');
  return {
    fullName: stringValue(record, 'fullName'),
    phone: stringValue(record, 'phone'),
    email: stringValue(record, 'email'),
    line1: stringValue(record, 'line1'),
    ...(line2 ? { line2 } : {}),
    ...(ward ? { ward } : {}),
    district: stringValue(record, 'district'),
    province: stringValue(record, 'province'),
    ...(postalCode ? { postalCode } : {}),
    country: optionalString(record, 'country') ?? 'VN',
  };
}

function stringValue(record: Prisma.JsonObject, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function optionalString(record: Prisma.JsonObject, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value ? value : undefined;
}
