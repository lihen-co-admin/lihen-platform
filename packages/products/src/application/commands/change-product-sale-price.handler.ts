import type { Clock, IdGenerator } from '@lihen/core';
import { Money } from '@lihen/shared';
import { Product } from '../../domain/product';
import { ProductSalePriceChange } from '../../domain/product-sale-price-change';
import { ProductNotFoundError, ProductSalePriceUnchangedError } from '../../domain/errors/product-errors';
import type { ProductPricingRepository } from '../../ports/product-pricing-repository';
import type { ProductRepository } from '../../ports/product-repository';
import type { ProductSalePriceChangeDTO } from '../dto/product-sale-price-change.dto';
import type { ChangeProductSalePriceCommand } from './change-product-sale-price.command';

export interface ChangeProductSalePriceResult {
  readonly productId: string;
  readonly previousPrice: { readonly amount: number; readonly currency: string };
  readonly newPrice: { readonly amount: number; readonly currency: string };
  readonly history: ProductSalePriceChangeDTO;
}

export class ChangeProductSalePriceHandler {
  public constructor(
    private readonly products: ProductRepository,
    private readonly pricing: ProductPricingRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: ChangeProductSalePriceCommand): Promise<ChangeProductSalePriceResult> {
    const current = await this.products.findById(command.payload.productId);
    if (!current) {
      throw new ProductNotFoundError(command.payload.productId);
    }

    if (current.salePrice.amount === command.payload.newPrice) {
      throw new ProductSalePriceUnchangedError(command.payload.newPrice);
    }

    const newPrice = new Money(command.payload.newPrice, current.salePrice.currency);
    const changedAt = this.clock.now();
    const history = new ProductSalePriceChange({
      id: this.ids.generate(),
      productId: current.id,
      previousPrice: current.salePrice,
      newPrice,
      reason: command.payload.reason,
      actorId: command.actorId,
      changedAt,
    });

    const updated = new Product({
      id: current.id,
      ...(current.sku ? { sku: current.sku } : {}),
      ...(current.catalogCode ? { catalogCode: current.catalogCode } : {}),
      slug: current.slug,
      name: current.name,
      businessLine: current.businessLine,
      ...(current.brandId ? { brandId: current.brandId } : {}),
      ...(current.categoryId ? { categoryId: current.categoryId } : {}),
      status: current.status,
      salePrice: newPrice,
    });

    const persisted = await this.pricing.changeSalePrice(updated, history, {
      operationKey: command.operationKey ?? command.commandId,
    });

    return {
      productId: persisted.product.id,
      previousPrice: {
        amount: persisted.historyEntry.previousPrice.amount,
        currency: persisted.historyEntry.previousPrice.currency,
      },
      newPrice: {
        amount: persisted.historyEntry.newPrice.amount,
        currency: persisted.historyEntry.newPrice.currency,
      },
      history: {
        id: persisted.historyEntry.id,
        productId: persisted.historyEntry.productId,
        previousPrice: {
          amount: persisted.historyEntry.previousPrice.amount,
          currency: persisted.historyEntry.previousPrice.currency,
        },
        newPrice: {
          amount: persisted.historyEntry.newPrice.amount,
          currency: persisted.historyEntry.newPrice.currency,
        },
        reason: persisted.historyEntry.reason,
        actorId: persisted.historyEntry.actorId,
        changedAt: persisted.historyEntry.changedAt.toISOString(),
      },
    };
  }
}
