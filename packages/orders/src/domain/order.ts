export const orderStatuses = ['DRAFT','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED'] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderChannels = ['WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER'] as const;
export type OrderChannel = (typeof orderChannels)[number];
export interface Order {
  readonly id:string; readonly orderNumber:string; readonly status:OrderStatus; readonly channel:OrderChannel;
  readonly customerName:string|null; readonly customerPhone:string|null; readonly notes:string|null;
  readonly requestedAt:Date|null; readonly createdAt:Date; readonly updatedAt:Date;
}
export interface OrderItem {readonly id:string;readonly orderId:string;readonly productId:string;readonly quantity:number;readonly unitPrice:number;readonly notes:string|null;}
