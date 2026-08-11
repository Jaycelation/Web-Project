'use client';

import type { ProductDetailDto, ProductVariantDto } from '@secure-commerce/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface BrowserCartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
}

interface CartContextValue {
  items: BrowserCartLine[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  guestSessionId: string;
  addItem: (product: ProductDetailDto, variant: ProductVariantDto, quantity: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'secure-commerce-cart-v1';
const GUEST_KEY = 'secure-commerce-guest-session-v1';
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BrowserCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [guestSessionId, setGuestSessionId] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(validateStoredCart(JSON.parse(stored)));
      let guest = localStorage.getItem(GUEST_KEY);
      if (!guest) {
        guest = crypto.randomUUID();
        localStorage.setItem(GUEST_KEY, guest);
      }
      setGuestSessionId(guest);
    } catch {
      setItems([]);
      const guest = crypto.randomUUID();
      setGuestSessionId(guest);
      localStorage.setItem(GUEST_KEY, guest);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try { setItems(validateStoredCart(JSON.parse(event.newValue))); } catch { /* ignore invalid cross-tab value */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((product: ProductDetailDto, variant: ProductVariantDto, quantity: number) => {
    setItems((current) => {
      const safeQuantity = Math.max(1, Math.min(quantity, variant.availableStock, 100));
      const existing = current.find((item) => item.variantId === variant.id);
      if (existing) {
        return current.map((item) => item.variantId === variant.id
          ? { ...item, quantity: Math.min(item.quantity + safeQuantity, variant.availableStock, 100), unitPrice: variant.price, availableStock: variant.availableStock }
          : item);
      }
      return [...current, {
        variantId: variant.id,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        variantName: variant.name,
        sku: variant.sku,
        imageUrl: product.images[0]?.url ?? product.imageUrl,
        unitPrice: variant.price,
        quantity: safeQuantity,
        availableStock: variant.availableStock,
      }];
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) => current.map((item) => item.variantId === variantId
      ? { ...item, quantity: Math.max(1, Math.min(quantity, item.availableStock, 100)) }
      : item));
  }, []);
  const removeItem = useCallback((variantId: string) => setItems((current) => current.filter((item) => item.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    hydrated,
    guestSessionId,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clear,
  }), [items, hydrated, guestSessionId, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart phải nằm trong CartProvider.');
  return context;
}

function validateStoredCart(value: unknown): BrowserCartLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BrowserCartLine => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.variantId === 'string'
      && typeof record.productName === 'string'
      && typeof record.unitPrice === 'number'
      && Number.isSafeInteger(record.unitPrice)
      && typeof record.quantity === 'number'
      && Number.isSafeInteger(record.quantity)
      && record.quantity >= 1;
  }).slice(0, 50);
}
