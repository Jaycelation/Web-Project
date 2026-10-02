/** Isolated SERVICE tests with explicit Nest/Prisma doubles, not integration or SQL tests. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as domain from '../packages/domain/dist/index.js';
const require = createRequire(import.meta.url);
const ts = require('typescript');
class HttpError extends Error { constructor(body) { super(body.message); this.body=body; } }
class BadRequestException extends HttpError {}
class ConflictException extends HttpError {}
class ForbiddenException extends HttpError {}
class NotFoundException extends HttpError {}
class KnownError extends Error { constructor(code) { super(code); this.code=code; } }
class Sql {
  constructor(parts, values) {
    this.text='';this.values=[];
    parts.forEach((part,i)=>{this.text+=part;if(i<values.length){const v=values[i];if(v instanceof Sql){this.text+=v.text;this.values.push(...v.values);}else{this.text+='?';this.values.push(v);}}});
  }
}
const Prisma = {PrismaClientKnownRequestError:KnownError,TransactionIsolationLevel:{Serializable:'Serializable',RepeatableRead:'RepeatableRead'},
  sql:(parts,...values)=>new Sql(parts,values),join:(values,separator)=>new Sql(Array.from({length:values.length+1},(_,i)=>i===0||i===values.length?'':separator),values)};
const enums = new Proxy({}, {get:(_,key)=>key});
function load(relative) {
  const source=readFileSync(new URL(relative,import.meta.url),'utf8');
  const {outputText} = ts.transpileModule(source,{fileName:relative,compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true}});
  const module={exports:{}};
  const fakeRequire=(id)=>{
    if(id==='@nestjs/common')return{Injectable:()=>()=>{},BadRequestException,ConflictException,ForbiddenException,NotFoundException};
    if(id==='@prisma/client')return{Prisma,OrderStatus:enums,PaymentStatus:enums,ProductStatus:enums};
    if(id==='@secure-commerce/domain')return domain;
    if(id.endsWith('/prisma.service.js'))return{PrismaService:class {}};
    if(id.endsWith('order.mapper.js'))return{mapOrder:(order)=>order,orderInclude:{items:true}};
    throw new Error(`Unexpected dependency in isolated test: ${id}`);
  };
  new Function('require','module','exports',outputText)(fakeRequire,module,module.exports);
  return module.exports;
}
const {OperationsService}=load('../apps/api/src/modules/operations/operations.service.ts');
const {ReviewsService}=load('../apps/api/src/modules/reviews/reviews.service.ts');
const {OrdersService}=load('../apps/api/src/modules/orders/orders.service.ts');
const {CatalogService}=load('../apps/api/src/modules/catalog/catalog.service.ts');
const actor={id:'admin',name:'Admin',role:'ADMIN'};
const expectCode=(code)=>(e)=>e instanceof HttpError&&e.body.code===code;
function transaction(tx){return {$transaction:async(fn,options)=>{tx.lastIsolation=options?.isolationLevel;return typeof fn==='function'?fn(tx):Promise.all(fn);}};}
function transferFixture(patch={}){
  const order={id:'o',status:'PENDING_CONFIRMATION',paymentMethod:'BANK_TRANSFER',paymentStatus:'AWAITING_TRANSFER',total:100000,
    payments:[{id:'pay',method:'BANK_TRANSFER',status:'AWAITING_TRANSFER',amount:100000,provider:null,providerRef:null}],...patch};
  const writes=[];const tx={order:{findUnique:async()=>order,update:async(args)=>{writes.push(['order',args]);return{};}},payment:{update:async(args)=>{writes.push(['payment',args]);return{};}},adminAuditLog:{create:async(args)=>{writes.push(['audit',args]);return{};}}};
  return{order,tx,writes,service:new OperationsService(transaction(tx))};
}
const confirm={orderId:'o',providerRef:'BANK-001',expectedTotal:100000};
test('transfer updates payment and order with audit in Serializable transaction',async()=>{
  const f=transferFixture();assert.deepEqual(await f.service.confirmTransfer(confirm,actor),{ok:true,alreadyConfirmed:false});
  assert.equal(f.tx.lastIsolation,'Serializable');assert.deepEqual(f.writes.map(([t])=>t),['payment','order','audit']);
  assert.equal(f.writes[0][1].data.provider,'MANUAL_BANK');assert.equal(f.writes[1][1].data.paymentStatus,'PAID');
});
for(const status of ['CANCELLED','REFUNDED','RETURN_REQUESTED'])test(`transfer rejects ${status}`,async()=>{
  const f=transferFixture({status});await assert.rejects(f.service.confirmTransfer(confirm,actor),expectCode('TRANSFER_NOT_ALLOWED'));assert.equal(f.writes.length,0);
});
test('transfer rejects COD and mismatched order total',async()=>{
  await assert.rejects(transferFixture({paymentMethod:'COD'}).service.confirmTransfer(confirm,actor),expectCode('TRANSFER_NOT_ALLOWED'));
  await assert.rejects(transferFixture().service.confirmTransfer({...confirm,expectedTotal:1},actor),expectCode('TRANSFER_NOT_ALLOWED'));
});
test('transfer rejects payment amount mismatch',async()=>{const f=transferFixture();f.order.payments[0].amount=1;await assert.rejects(f.service.confirmTransfer(confirm,actor),expectCode('TRANSFER_RECORD_INVALID'));assert.equal(f.writes.length,0);});
test('transfer rejects ambiguous multiple bank records',async()=>{const f=transferFixture();f.order.payments.push({...f.order.payments[0],id:'other'});await assert.rejects(f.service.confirmTransfer(confirm,actor),expectCode('TRANSFER_RECORD_INVALID'));});
test('transfer same manual bank reference is idempotent',async()=>{
  const f=transferFixture({paymentStatus:'PAID'});Object.assign(f.order.payments[0],{status:'PAID',provider:'MANUAL_BANK',providerRef:confirm.providerRef});
  assert.deepEqual(await f.service.confirmTransfer(confirm,actor),{ok:true,alreadyConfirmed:true});assert.equal(f.writes.length,0);
});
test('transfer paid with a different reference is not overwritten',async()=>{
  const f=transferFixture({paymentStatus:'PAID'});Object.assign(f.order.payments[0],{status:'PAID',provider:'MANUAL_BANK',providerRef:'other'});
  await assert.rejects(f.service.confirmTransfer(confirm,actor),expectCode('TRANSFER_ALREADY_PROCESSED'));assert.equal(f.writes.length,0);
});
test('transfer missing order is a 404 branch',async()=>{const f=transferFixture();f.tx.order.findUnique=async()=>null;await assert.rejects(f.service.confirmTransfer(confirm,actor),expectCode('ORDER_NOT_FOUND'));});
for(const code of ['P2002','P2034'])test(`operations maps ${code} to retryable conflict`,async()=>{
  const service=new OperationsService({$transaction:async()=>{throw new KnownError(code);}});await assert.rejects(service.confirmTransfer(confirm,actor),expectCode('OPERATION_CONFLICT'));
});
test('invalid coupon rejected before touching persistence',async()=>{
  let calls=0;const service=new OperationsService({$transaction:async()=>{calls++;}});
  await assert.rejects(service.createCoupon({code:'X'},actor),expectCode('COUPON_CODE_INVALID'));assert.equal(calls,0);
});
test('moderation changes status only and emits audit',async()=>{
  let update,audit;const tx={review:{findUnique:async()=>({id:'r',status:'PENDING'}),update:async(args)=>{update=args;return{id:'r',status:args.data.status};}},adminAuditLog:{create:async(args)=>{audit=args;}}};
  await new OperationsService(transaction(tx)).moderate({reviewId:'r',status:'APPROVED'},actor);
  assert.deepEqual(update.data,{status:'APPROVED'});assert.equal(audit.data.before.status,'PENDING');assert.equal(audit.data.after.status,'APPROVED');
});
test('CSV export caps rows and selects no direct customer PII',async()=>{
  let selection,audit;const tx={order:{findMany:async(args)=>{selection=args;return[{orderNo:'=1+1',createdAt:new Date('2026-01-01'),status:'DELIVERED',paymentMethod:'COD',paymentStatus:'PAID',subtotal:1,discount:0,shippingFee:0,total:1}];},count:async()=>300},adminAuditLog:{create:async(args)=>{audit=args;}}};
  const result=await new OperationsService(transaction(tx)).exportOrders({page:1,pageSize:20,query:'needle'},actor);
  assert.equal(selection.take,250);assert.equal(selection.select.shippingAddress,undefined);assert.equal(selection.select.guestEmail,undefined);
  assert.equal(selection.where.OR.length,4);assert.equal(result.truncated,true);assert.ok(result.csv.includes('"text: =1+1"'));assert.equal(audit.data.action,'ORDERS_EXPORTED');
});
function reviewFixture(item){
  let saved;const tx={orderItem:{findFirst:async()=>item},review:{create:async(args)=>{saved=args;return{id:'r',status:args.data.status};}}};
  return {tx,service:new ReviewsService(transaction(tx)),saved:()=>saved};
}
const delivered={id:'item',productId:'product',order:{userId:'u1',status:'DELIVERED'},product:{status:'ACTIVE',category:{active:true}}};
const reviewInput={orderItemId:'item',rating:5,comment:'Good purchase'};
test('review created pending for delivered owner only',async()=>{const f=reviewFixture(delivered);assert.deepEqual(await f.service.create(reviewInput,'u1'),{id:'r',status:'PENDING'});assert.equal(f.saved().data.userId,'u1');assert.equal(f.tx.lastIsolation,'Serializable');});
for(const [label,item,user] of [
  ['missing purchase',null,'u1'],['other owner',delivered,'u2'],['not delivered',{...delivered,order:{userId:'u1',status:'SHIPPING'}},'u1'],
  ['deleted product',{...delivered,product:null,productId:null},'u1'],['hidden product',{...delivered,product:{status:'HIDDEN',category:{active:true}}},'u1'],
  ['inactive category',{...delivered,product:{status:'ACTIVE',category:{active:false}}},'u1'],
])test(`review rejects ${label}`,async()=>{const f=reviewFixture(item);await assert.rejects(f.service.create(reviewInput,user),expectCode('REVIEW_PURCHASE_REQUIRED'));assert.equal(f.saved(),undefined);});
for(const [code,expected] of [['P2002','REVIEW_ALREADY_EXISTS'],['P2034','REVIEW_CONFLICT']])test(`review maps ${code}`,async()=>{
  await assert.rejects(new ReviewsService({$transaction:async()=>{throw new KnownError(code);}}).create(reviewInput,'u1'),expectCode(expected));
});
test('public reviews approved only, mask author, return aggregate',async()=>{
  let query;const prisma={...transaction({}),product:{findFirst:async()=>({id:'product'})},review:{
    findMany:async(args)=>{query=args;return[{id:'r',userId:'u1',rating:5,comment:'ok',createdAt:new Date('2026-01-01'),user:{name:'Nguyen Van Test'},orderItem:{productId:'product',order:{userId:'u1'}}}];},
    aggregate:async()=>({_count:1,_avg:{rating:5}}),groupBy:async()=>[{rating:5,_count:{_all:1}}],
  }};
  const result=await new ReviewsService(prisma).list({productId:'product',page:1,pageSize:5});
  assert.equal(query.where.status,'APPROVED');assert.equal(result.items[0].authorName,'Test N.');assert.equal(result.items[0].userId,undefined);
  assert.equal(result.summary.count,1);assert.equal(result.summary.distribution[5],1);assert.equal(result.items[0].verifiedPurchase,true);
});
test('customer cancellation rechecks ownership and status inside transaction',async()=>{
  const tx={order:{findUnique:async()=>({id:'o',userId:'u1',status:'CONFIRMED'})}};
  const prisma={...transaction(tx),order:{findFirst:async()=>({status:'PENDING_CONFIRMATION'})}};
  await assert.rejects(new OrdersService(prisma).cancelMine({id:'u1',name:'Buyer',role:'CUSTOMER'},'o','changed mind'),expectCode('ORDER_ACTION_FORBIDDEN'));
});
for(const [prior,delivery,expected] of [['SHIPPING',null,1],['RETURN_REQUESTED',new Date('2026-01-01'),0]])test(`delivery counter from ${prior} increments ${expected} time`,async()=>{
  let increments=0,patch;const current={id:'o',userId:'u1',status:prior,deliveredAt:delivery,paymentMethod:'BANK_TRANSFER',items:[{productId:'p',quantity:2}]};
  const tx={order:{findUnique:async()=>current,update:async(args)=>{patch=args.data;return{...current,...patch};}},product:{update:async()=>{increments++;}},adminAuditLog:{create:async()=>({})}};
  await new OrdersService(transaction(tx)).updateStatus({orderId:'o',status:'DELIVERED'},actor);
  assert.equal(increments,expected);assert.equal(Boolean(patch.deliveredAt),expected===1);
});
test('catalog invalid price range rejected before query',async()=>{
  await assert.rejects(new CatalogService({}).search({page:1,pageSize:12,minPrice:20,maxPrice:10}),expectCode('PRICE_RANGE_INVALID'));
});
test('catalog SQL uses bound input and stock minus reserved semantics',async()=>{
  const queries=[];const tx={$queryRaw:async(q)=>{queries.push(q);return queries.length===1?[]:[{total:0n}];},product:{findMany:async()=>[]},category:{findMany:async()=>[]},brand:{findMany:async()=>[]}};
  const needle="' OR 1=1 --";
  const result=await new CatalogService(transaction(tx)).search({page:2,pageSize:12,inStock:true,query:needle,sort:'price_asc'});
  assert.equal(result.total,0);assert.ok(queries[0].values.includes(needle));assert.equal(queries[0].text.includes(needle),false);
  assert.ok(queries[0].text.includes('pv."stock" > pv."reservedStock"'));assert.ok(queries[0].text.includes('MIN(pv."price")'));
  assert.equal(tx.lastIsolation,'RepeatableRead');
});
