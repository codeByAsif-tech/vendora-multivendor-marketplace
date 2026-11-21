import { describe, expect, it } from 'vitest';
import {
  deriveOptions,
  discountPercent,
  effectivePrice,
  stockState,
  summarizeVariants,
} from '../src/utils/productPricing.js';

describe('productPricing', () => {
  it('uses the sale price only when it is lower than the price', () => {
    expect(effectivePrice({ price: 1000, salePrice: 800 })).toBe(800);
    expect(effectivePrice({ price: 1000, salePrice: null })).toBe(1000);
    expect(effectivePrice({ price: 1000, salePrice: 1200 })).toBe(1000);
  });

  it('rounds the discount percentage', () => {
    expect(discountPercent({ price: 99900, salePrice: 79900 })).toBe(20);
    expect(discountPercent({ price: 1000 })).toBe(0);
  });

  it('classifies stock levels', () => {
    expect(stockState({ stock: 0, lowStockThreshold: 5 })).toBe('out');
    expect(stockState({ stock: 5, lowStockThreshold: 5 })).toBe('low');
    expect(stockState({ stock: 6, lowStockThreshold: 5 })).toBe('in');
  });

  it('summarizes only active variants', () => {
    const summary = summarizeVariants([
      { price: 1000, salePrice: 900, stock: 2, isActive: true },
      { price: 500, stock: 4, isActive: false },
      { price: 2000, stock: 1, isActive: true },
    ]);
    expect(summary).toEqual({ minPrice: 900, maxPrice: 2000, compareAtPrice: 1000, totalStock: 3, maxDiscount: 10 });
  });

  it('falls back to all variants for prices when every variant is inactive', () => {
    const summary = summarizeVariants([{ price: 700, stock: 3, isActive: false }]);
    expect(summary).toMatchObject({ minPrice: 700, totalStock: 0 });
  });

  it('builds unique option values in first-seen order, case-insensitively', () => {
    const options = deriveOptions([
      { attributes: [{ name: 'Size', value: 'M' }] },
      { attributes: [{ name: 'size', value: 'm' }] },
      { attributes: [{ name: 'Size', value: 'L' }] },
    ]);
    expect(options).toEqual([{ name: 'Size', values: ['M', 'L'] }]);
  });
});
