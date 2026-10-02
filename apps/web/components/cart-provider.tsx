'use client';

import { clampCartQuantity } from '@secure-commerce/domain';
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
  persistent: boolean;
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
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    let guest = crypto.randomUUID();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) { try { setItems(validateStoredCart(JSON.parse(stored))); } catch { setItems([]); } }
      const savedGuest = localStorage.getItem(GUEST_KEY);
      if (savedGuest && /^[0-9a-f-]{36}$/iu.test(savedGuest)) guest = savedGuest as typeof guest;
      else localStorage.setItem(GUEST_KEY, guest);
    } catch { setPersistent(false); }
    setGuestSessionId(guest); setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { setPersistent(false); }
  }, [hydrated, items]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try { setItems(event.newValue ? validateStoredCart(JSON.parse(event.newValue)) : []); }
      catch { /* Ignore malformed data from another tab. */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((product: ProductDetailDto, variant: ProductVariantDto, quantity: number) => {
    if (!variant.active || !Number.isFinite(quantity) || quantity < 1) return;
    const safeQuantity = clampCartQuantity(quantity, variant.availableStock);
    if (!safeQuantity) return;
    setItems((current) => {
      const existing = current.find((item) => item.variantId === variant.id);
      if (existing) {
        return current.map((item) => item.variantId === variant.id
          ? { ...item, quantity: Math.min(item.quantity + safeQuantity, variant.availableStock, 100), unitPrice: variant.price, availableStock: variant.availableStock }
          : item);
      }
      if (current.length >= 50) return current;
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
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setItems((current) => current.flatMap((item) => {
      if (item.variantId !== variantId) return [item];
      const safe = clampCartQuantity(quantity, item.availableStock);
      return safe ? [{...item, quantity: safe}] : [];
    }));
  }, []);
  const removeItem = useCallback((variantId: string) => setItems((current) => current.filter((item) => item.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    hydrated,
    guestSessionId,
    persistent,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clear,
  }), [items, hydrated, guestSessionId, persistent, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart phải nằm trong CartProvider.');
  return context;
}

function validateStoredCart(value: unknown): BrowserCartLine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is BrowserCartLine => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    for (const key of ['variantId','productId','productSlug','productName','variantName','sku','imageUrl']) {
      if (typeof record[key] !== 'string' || !(record[key] as string).length || (record[key] as string).length > 2000) return false;
    }
    for (const key of ['unitPrice','quantity','availableStock']) {
      if (typeof record[key] !== 'number' || !Number.isSafeInteger(record[key]) || (record[key] as number) < 0) return false;
    }
    const id = record.variantId as string;
    if (seen.has(id) || (record.quantity as number) < 1 || (record.quantity as number) > 100 ||
      (record.quantity as number) > (record.availableStock as number) || (record.unitPrice as number) > 2147483647) return false;
    seen.add(id); return true;
  }).slice(0, 50);
}
