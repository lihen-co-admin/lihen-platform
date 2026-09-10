import type { Customer } from '../../domain/customer';

export interface CustomerOrderProjection {
  readonly orderId: string;
  readonly customerId: string | null;
  readonly createdAt: Date;
}

export interface CustomerSaleProjection {
  readonly saleId: string;
  readonly orderId: string | null;
  readonly totalAmount: number;
  readonly occurredAt: Date;
}

export interface CustomerPurchaseHistoryItem {
  readonly saleId: string;
  readonly orderId: string | null;
  readonly totalAmount: number;
  readonly occurredAt: Date;
  readonly linkage: 'ORDER_CUSTOMER';
}

export interface CustomerProfileReadModel {
  readonly customer: Customer;
  readonly orderCount: number;
  readonly purchaseCount: number;
  readonly lifetimeValue: number;
  readonly lastOrderAt: Date | null;
  readonly lastPurchaseAt: Date | null;
  readonly purchaseHistory: readonly CustomerPurchaseHistoryItem[];
}

export function buildCustomerProfileReadModel(input: {
  readonly customer: Customer;
  readonly orders: readonly CustomerOrderProjection[];
  readonly sales: readonly CustomerSaleProjection[];
}): CustomerProfileReadModel {
  const customerOrders = input.orders.filter(
    (order) => order.customerId === input.customer.id,
  );

  const customerOrderIds = new Set(
    customerOrders.map((order) => order.orderId),
  );

  const purchaseHistory: CustomerPurchaseHistoryItem[] = input.sales
    .filter(
      (sale) =>
        sale.orderId !== null &&
        customerOrderIds.has(sale.orderId),
    )
    .map((sale) => ({
      saleId: sale.saleId,
      orderId: sale.orderId,
      totalAmount: sale.totalAmount,
      occurredAt: sale.occurredAt,
      linkage: 'ORDER_CUSTOMER' as const,
    }))
    .sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime(),
    );

  const ordersByNewest = [...customerOrders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    customer: input.customer,
    orderCount: customerOrders.length,
    purchaseCount: purchaseHistory.length,
    lifetimeValue: purchaseHistory.reduce(
      (total, purchase) => total + purchase.totalAmount,
      0,
    ),
    lastOrderAt: ordersByNewest[0]?.createdAt ?? null,
    lastPurchaseAt: purchaseHistory[0]?.occurredAt ?? null,
    purchaseHistory,
  };
}
