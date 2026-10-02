'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCollections } from './collections-provider';
export function ProductActions({ productId }: { productId: string }) {
  const { collections, ready, toggle } = useCollections(); const [notice, setNotice] = useState('');
  const saved = collections.wishlist.includes(productId), compared = collections.compare.includes(productId);
  const change = (kind: 'wishlist' | 'compare') => {
    const limit = kind === 'compare' ? 4 : 20;
    if (!collections[kind].includes(productId) && collections[kind].length >= limit) {
      setNotice(`Tối đa ${limit} sản phẩm. Hãy bỏ bớt lựa chọn cũ.`); return;
    }
    setNotice(''); toggle(kind, productId);
  };
  return <div className="product-actions"><div className="inline-actions">
    <button type="button" disabled={!ready} aria-pressed={saved} className="button button-outline button-sm" onClick={() => change('wishlist')}>{saved ? '♥ Đã lưu' : '♡ Yêu thích'}</button>
    <button type="button" disabled={!ready} aria-pressed={compared} className="button button-outline button-sm" onClick={() => change('compare')}>{compared ? '✓ So sánh' : '+ So sánh'}</button>
  </div>{notice && <small role="status">{notice}</small>}</div>;
}
export function TrackProductView({ productId }: { productId: string }) {
  const { ready, remember } = useCollections();
  useEffect(() => { if (ready) remember(productId); }, [ready, remember, productId]);
  return null;
}
export function CollectionNav() {
  const { collections } = useCollections();
  return <nav className="collection-nav" aria-label="Bộ sưu tập cá nhân"><div className="container">
    <Link href="/yeu-thich">♡ Yêu thích <b>{collections.wishlist.length}</b></Link>
    <Link href="/so-sanh">So sánh <b>{collections.compare.length}/4</b></Link>
    <Link href="/da-xem">Đã xem <b>{collections.recent.length}</b></Link>
  </div></nav>;
}
