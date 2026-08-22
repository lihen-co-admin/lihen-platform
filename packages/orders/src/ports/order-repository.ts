import type {CreateOrderDraftCommand} from '../application/commands/create-order-draft.command';
import type {ConfirmOrderCommand} from '../application/commands/confirm-order.command';
import type {CancelOrderCommand} from '../application/commands/cancel-order.command';
import type {Order,OrderItem} from '../domain/order';
export interface OrderRepository {list():Promise<readonly Order[]>;getById(id:string):Promise<Order|null>;listItems(orderId:string):Promise<readonly OrderItem[]>;createDraft(command:CreateOrderDraftCommand):Promise<Order>;confirm(command:ConfirmOrderCommand):Promise<Order>;cancel(command:CancelOrderCommand):Promise<Order>;}
