'use client';

import type { ProductDetailDto } from '@secure-commerce/contracts';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { CartIcon, LockIcon, PackageIcon, ShieldIcon } from './icons';

export function ProductDetailView({ product }: { product: ProductDetailDto }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState(product.variants.find((item) => item.availableStock > 0)?.id ?? product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) ?? product.variants[0], [product.variants, variantId]);
  const image = product.images[imageIndex] ?? product.images[0];

  const add = (goToCart: boolean) => {
    if (!variant || variant.availableStock < 1) return;
    addItem(product, variant, quantity);
    setNotice(`Đã thêm ${quantity} × ${product.name} vào giỏ.`);
    if (goToCart) router.push('/gio-hang');
  };

  return <div className="product-detail-grid">
    <div className="product-gallery">
      <div className="product-thumbnails">
        {product.images.map((item, index) => <button key={item.id} type="button" className={`product-thumbnail ${index === imageIndex ? 'active' : ''}`} onClick={() => setImageIndex(index)}><Image src={item.url} alt={item.alt} width={80} height={80} /></button>)}
      </div>
      <div className="product-main-image"><Image src={image?.url ?? product.imageUrl} alt={image?.alt ?? product.imageAlt} width={760} height={680} priority /></div>
    </div>

    <div className="product-info">
      <div className="product-meta"><span>{product.category.name}</span><span>{product.brand?.name ?? 'Chính hãng'}</span><span>SKU {variant?.sku ?? product.skuBase}</span></div>
      <h1>{product.name}</h1>
      <p className="product-subtitle">{product.shortDescription}</p>
      <div className="product-rating"><span className="stars">★★★★★</span><span>4,9 · 128 đánh giá đã xác minh</span></div>
      <div className="detail-price"><strong>{formatMoney(variant?.price ?? product.price)}</strong>{variant?.compareAtPrice && <del>{formatMoney(variant.compareAtPrice)}</del>}<span className={`stock-pill ${!variant?.availableStock ? 'out' : ''}`}>{variant?.availableStock ? `Còn ${variant.availableStock} sản phẩm` : 'Hết hàng'}</span></div>

      <div className="option-block">
        <div className="option-label">Chọn phiên bản <span>{variant?.name}</span></div>
        <div className="variant-options">{product.variants.map((item) => <button type="button" key={item.id} disabled={!item.active || item.availableStock < 1} className={`variant-option ${variantId === item.id ? 'active' : ''}`} onClick={() => { setVariantId(item.id); setQuantity(1); }}><strong>{item.name}</strong><small>{formatMoney(item.price)} · {item.availableStock} còn lại</small></button>)}</div>
      </div>

      <div className="option-block">
        <div className="option-label">Số lượng <span>Tối đa {Math.min(variant?.availableStock ?? 0, 100)}</span></div>
        <div className="quantity-control"><button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><span>{quantity}</span><button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((value) => Math.min(value + 1, variant?.availableStock ?? 1, 100))}>+</button></div>
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      <div className="purchase-actions">
        <button className="button button-outline" type="button" disabled={!variant?.availableStock} onClick={() => add(false)}><CartIcon /> Thêm giỏ hàng</button>
        <button className="button button-primary" type="button" disabled={!variant?.availableStock} onClick={() => add(true)}>Mua ngay</button>
      </div>
      <div className="detail-assurances">
        <div><ShieldIcon /><strong>Hàng chính hãng</strong>Thông tin SKU và tồn kho rõ ràng.</div>
        <div><PackageIcon /><strong>Đổi trả 7 ngày</strong>Theo chính sách và điều kiện.</div>
        <div><LockIcon /><strong>Checkout an toàn</strong>Tổng tiền tính lại phía server.</div>
      </div>
    </div>
  </div>;
}
