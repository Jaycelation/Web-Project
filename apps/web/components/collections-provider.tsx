'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { COLLECTION_LIMITS, normalizeProductIds, rememberProduct, toggleProductId, type CollectionKind } from '@secure-commerce/domain';
type Collections = Record<CollectionKind, string[]>;
interface Context { collections: Collections; ready: boolean; persistent: boolean;
  toggle: (kind: 'wishlist' | 'compare', id: string) => void; remember: (id: string) => void; clear: (kind: CollectionKind) => void; }
const KEY = 'mira-collections-v1';
const empty = (): Collections => ({ wishlist: [], compare: [], recent: [] });
function parse(value: string | null): Collections {
  try {
    const data: unknown = JSON.parse(value ?? '{}');
    const input = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    return { wishlist: normalizeProductIds(input.wishlist, 20), compare: normalizeProductIds(input.compare, 4), recent: normalizeProductIds(input.recent, 12) };
  } catch { return empty(); }
}
const CollectionContext = createContext<Context | null>(null);
export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collections>(empty);
  const [ready, setReady] = useState(false); const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try { setCollections(parse(localStorage.getItem(KEY))); } catch { setPersistent(false); }
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === KEY || event.key === null) setCollections(parse(event.newValue)); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(collections)); } catch { setPersistent(false); }
  }, [ready, collections]);
  const toggle = useCallback((kind: 'wishlist' | 'compare', id: string) => setCollections((prev) => ({ ...prev, [kind]: toggleProductId(prev[kind], id, COLLECTION_LIMITS[kind]) })), []);
  const remember = useCallback((id: string) => setCollections((prev) => prev.recent[0] === id ? prev : { ...prev, recent: rememberProduct(prev.recent, id) }), []);
  const clear = useCallback((kind: CollectionKind) => setCollections((prev) => ({ ...prev, [kind]: [] })), []);
  const value = useMemo(() => ({ collections, ready, persistent, toggle, remember, clear }), [collections, ready, persistent, toggle, remember, clear]);
  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
export function useCollections() { const value = useContext(CollectionContext); if (!value) throw new Error('Missing CollectionsProvider'); return value; }
