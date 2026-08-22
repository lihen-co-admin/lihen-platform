import type {OrderChannel} from '../../domain/order';
export interface CreateOrderDraftItem {readonly id:string;readonly productId:string;readonly quantity:number;readonly unitPrice:number;readonly notes:string|null;}
export interface CreateOrderDraftCommand {readonly operationKey:string;readonly orderId:string;readonly orderNumber:string;readonly channel:OrderChannel;readonly customerName:string|null;readonly customerPhone:string|null;readonly notes:string|null;readonly requestedAt:Date|null;readonly items:readonly CreateOrderDraftItem[];}
