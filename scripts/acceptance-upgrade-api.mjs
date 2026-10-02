/** Live read-only smoke for new routes. Requires a running, seeded local API. */
import assert from 'node:assert/strict';
import {SecureApiClient,SecureApiError,SECURE_JWE_VERSION} from '../packages/crypto-envelope/dist/index.js';
const baseUrl=(process.env.API_BASE_URL??'http://localhost:4000/api/v1').replace(/\/+$/u,'');
const url=new URL(baseUrl);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&process.env.ACCEPTANCE_REMOTE!=='1') {
  throw new Error('Refusing a non-local API. Set ACCEPTANCE_REMOTE=1 only for an authorized test instance.');
}
const client=new SecureApiClient({baseUrl,protocolVersion:SECURE_JWE_VERSION,credentials:'omit'});
async function denied(path,body,status){
  await assert.rejects(client.request(path,body),(e)=>e instanceof SecureApiError&&e.status===status);
}
const catalog=await client.request('/catalog/search',{page:1,pageSize:5});
assert.ok(catalog.items.length>0,'Seed the test database before this smoke test.');
const ids=catalog.items.map(p=>p.id);
const selected=await client.request('/catalog/selection',{productIds:ids});
assert.deepEqual(selected.items.map(p=>p.id),ids);
assert.ok(selected.items.every(p=>Number.isSafeInteger(p.availableStock)&&p.availableStock>=0));
console.log('PASS: collection selection preserves order and returns availability');
const reviews=await client.request('/reviews/list',{productId:ids[0],page:1,pageSize:5});
assert.equal(reviews.summary.count,reviews.total);
assert.equal(Object.values(reviews.summary.distribution).reduce((a,b)=>a+b,0),reviews.total);
if(reviews.total===0)assert.equal(reviews.summary.average,null);
assert.ok(reviews.items.every(r=>!('userId' in r)&&!('email' in r)));
console.log('PASS: public review aggregate and field minimization');
await denied('/catalog/search',{minPrice:20,maxPrice:10},400);
await denied('/catalog/search',{inStock:'false'},400);
await denied('/catalog/selection',{productIds:['not-a-uuid']},400);
await denied('/reviews/list',{productId:ids[0],page:1,pageSize:1000},400);
console.log('PASS: invalid filters, IDs and pagination rejected');
for(const [path,body] of [
  ['/reviews/eligible',{productId:ids[0]}],
  ['/reviews/create',{orderItemId:ids[0],rating:5,comment:'not a purchase'}],
  ['/admin/reviews',{}],['/admin/coupons',{}],['/admin/audit',{}],
  ['/admin/payments/confirm-transfer',{orderId:ids[0],providerRef:'SMOKE-DO-NOT-WRITE',expectedTotal:0}],
])await denied(path,body,401);
console.log('PASS: anonymous requests cannot enter protected upgrade operations');
console.log('Live smoke finished. This does NOT cover authenticated writes, real DB races, payment providers or browser UI.');
