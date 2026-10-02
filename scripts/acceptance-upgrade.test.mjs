import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLLECTION_LIMITS, normalizeProductIds, toggleProductId, rememberProduct,
  availableQuantity, clampCartQuantity, canReviewPurchase, canCustomerTransition,
  validateCouponDefinition, csvCell, toCsv, catalogQueryString, priceOrder, DomainError,
} from '../packages/domain/dist/index.js';
const ids = Array.from({length:30}, (_,i) => `10000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
const coupon = {code:'WELCOME20', type:'PERCENTAGE', value:20, minOrder:0, usagePerUser:1,
  startsAt:'2026-01-01T00:00:00Z', expiresAt:'2027-01-01T00:00:00Z'};
test('collection limits match API selection bound', () => assert.deepEqual(COLLECTION_LIMITS,{wishlist:20,compare:4,recent:12}));
test('collections reject malformed values and normalize case', () => {
  assert.deepEqual(normalizeProductIds(null,20),[]);
  assert.deepEqual(normalizeProductIds([ids[0],ids[0],7,'bad'],20),[ids[0]]);
  assert.deepEqual(normalizeProductIds(['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],20),['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
});
test('collections enforce capacity', () => assert.equal(normalizeProductIds(ids,4).length,4));
test('invalid capacity never returns IDs', () => { for (const n of [0,-1,1.5,NaN]) assert.deepEqual(normalizeProductIds(ids,n),[]); });
test('toggle adds and removes without mutation', () => { const current=[ids[0]]; assert.deepEqual(toggleProductId(current,ids[1],4),ids.slice(0,2)); assert.deepEqual(current,[ids[0]]); assert.deepEqual(toggleProductId(current,ids[0],4),[]); });
test('full comparison refuses a fifth item but permits removal', () => { assert.deepEqual(toggleProductId(ids.slice(0,4),ids[4],4),ids.slice(0,4)); assert.equal(toggleProductId(ids.slice(0,4),ids[1],4).length,3); });
test('invalid ID cannot enter a collection', () => assert.deepEqual(toggleProductId([ids[0]],'<script>',4),[ids[0]]));
test('recent list is MRU and deduplicated', () => { const result=rememberProduct(ids.slice(0,12),ids[5]); assert.equal(result[0],ids[5]); assert.equal(result.length,12); assert.equal(new Set(result).size,12); });
test('recent list evicts the oldest at capacity', () => { const result=rememberProduct(ids.slice(0,12),ids[20]); assert.equal(result[0],ids[20]); assert.equal(result.includes(ids[11]),false); });
test('available stock subtracts reservations', () => {assert.equal(availableQuantity(10,7),3);assert.equal(availableQuantity(2,3),0);});
test('invalid inventory is not sellable', () => {for(const [a,b] of [[-1,0],[2,-1],[NaN,0],[2.5,0],[Infinity,0]])assert.equal(availableQuantity(a,b),0);});
test('zero available stock never adds one unit', () => assert.equal(clampCartQuantity(1,0),0));
test('cart bounds quantity by stock and server limit', () => { assert.equal(clampCartQuantity(20,3),3); assert.equal(clampCartQuantity(500,1000),100); assert.equal(clampCartQuantity(3.8,20),3); assert.equal(clampCartQuantity(NaN,5),0); });
test('delivered owner may review', () => assert.equal(canReviewPurchase('u1','u1','DELIVERED'),true));
test('other user and guest cannot review', () => {assert.equal(canReviewPurchase('u2','u1','DELIVERED'),false);assert.equal(canReviewPurchase('',null,'DELIVERED'),false);});
for(const status of ['PENDING_CONFIRMATION','CONFIRMED','PREPARING','SHIPPING','CANCELLED','REFUNDED','RETURN_REQUESTED']) {
  test(`review rejected for ${status}`, () => assert.equal(canReviewPurchase('u1','u1',status),false));
}
test('customer may cancel pending own order only', () => {assert.equal(canCustomerTransition('u1','u1','PENDING_CONFIRMATION','CANCELLED'),true);assert.equal(canCustomerTransition('u1','u1','CONFIRMED','CANCELLED'),false);assert.equal(canCustomerTransition('u2','u1','PENDING_CONFIRMATION','CANCELLED'),false);});
test('customer may request return but cannot self-refund', () => { assert.equal(canCustomerTransition('u1','u1','DELIVERED','RETURN_REQUESTED'),true);assert.equal(canCustomerTransition('u1','u1','RETURN_REQUESTED','REFUNDED'),false); });
test('valid coupon terms pass', () => assert.equal(validateCouponDefinition(coupon),null));
for(const [name,patch,code] of [
  ['code syntax',{code:'=EVIL'},'COUPON_CODE_INVALID'], ['percentage over 100',{value:101},'COUPON_PERCENT_INVALID'],
  ['zero percentage',{value:0},'COUPON_PERCENT_INVALID'], ['negative price',{minOrder:-1},'COUPON_AMOUNT_INVALID'],
  ['database integer overflow',{minOrder:2147483648},'COUPON_AMOUNT_INVALID'],
  ['fractional discount',{value:2.5},'COUPON_AMOUNT_INVALID'], ['zero user limit',{usagePerUser:0},'COUPON_USER_LIMIT_INVALID'],
  ['zero total limit',{usageLimit:0},'COUPON_USAGE_LIMIT_INVALID'], ['zero cap',{maxDiscount:0},'COUPON_CAP_INVALID'],
  ['fixed discount with cap',{type:'FIXED_AMOUNT',maxDiscount:100},'COUPON_CAP_INVALID'],
  ['free shipping with nonzero value',{type:'FREE_SHIPPING',value:10},'COUPON_SHIPPING_VALUE_INVALID'],
  ['invalid date',{startsAt:'invalid'},'COUPON_DATES_INVALID'],
  ['end before start',{expiresAt:'2025-01-01T00:00:00Z'},'COUPON_DATES_INVALID'],
  ['equal dates',{expiresAt:coupon.startsAt},'COUPON_DATES_INVALID'],
]) test(`coupon rejects ${name}`, () => assert.equal(validateCouponDefinition({...coupon,...patch}),code));
test('fixed and free shipping coupons pass with valid values', () => {assert.equal(validateCouponDefinition({...coupon,type:'FIXED_AMOUNT',value:5000}),null);assert.equal(validateCouponDefinition({...coupon,type:'FREE_SHIPPING',value:0}),null);});
test('CSV quotes embedded delimiters, quotes and multiline cells', () => assert.equal(csvCell('hello,"world"\nnext'),'"hello,""world""\nnext"'));
test('CSV prefixes formula-like textual cells visibly', () => {for(const value of ['=1+1','+1','-1','@SUM(A1)',' \t=evil','\nhello','\uff1d1']) assert.ok(csvCell(value).startsWith('"text: '),value);});
test('CSV keeps numeric cells and strips control characters', () => {assert.equal(csvCell(-5),'"-5"');assert.equal(csvCell('a\0b'),'"ab"');assert.equal(csvCell(null),'""');});
test('CSV uses UTF-8 BOM and CRLF', () => assert.equal(toCsv([['a',10],['b',20]]),'\uFEFF"a","10"\r\n"b","20"\r\n'));
test('catalog URL maps query to q and drops defaults', () => {const q=new URLSearchParams(catalogQueryString({query:'phone & case',page:1,pageSize:12,inStock:false,brand:undefined}));assert.equal(q.get('q'),'phone & case');assert.equal(q.has('query'),false);assert.equal(q.has('page'),false);assert.equal(q.has('pageSize'),false);assert.equal(q.has('inStock'),false);});
test('catalog URL preserves pagination and literal zero price', () => {const q=new URLSearchParams(catalogQueryString({page:12,minPrice:0,inStock:true}));assert.equal(q.get('page'),'12');assert.equal(q.get('minPrice'),'0');assert.equal(q.get('inStock'),'true');});
const pricing = {requestedLines:[{variantId:ids[0],quantity:2}], variants:new Map([[ids[0],{id:ids[0],unitPrice:100000,availableStock:5,active:true}]]),baseShippingFee:30000,freeShippingThreshold:1000000};
test('authoritative pricing plus percentage cap remains correct', () => assert.deepEqual(priceOrder({...pricing,coupon:{type:'PERCENTAGE',value:50,maxDiscount:25000}}),{lines:[{variantId:ids[0],quantity:2,unitPrice:100000,lineTotal:200000}],subtotal:200000,discount:25000,shippingFee:30000,total:205000}));
test('server pricing rejects overselling', () => assert.throws(()=>priceOrder({...pricing,requestedLines:[{variantId:ids[0],quantity:6}]}),(e)=>e instanceof DomainError&&e.code==='INSUFFICIENT_STOCK'));
test('fixed discount cannot make total negative', () => assert.equal(priceOrder({...pricing,coupon:{type:'FIXED_AMOUNT',value:9999999}}).total,30000));
test('free shipping affects shipping, not merchandise amount', () => {const r=priceOrder({...pricing,coupon:{type:'FREE_SHIPPING'}});assert.equal(r.shippingFee,0);assert.equal(r.subtotal,200000);assert.equal(r.total,200000);});
