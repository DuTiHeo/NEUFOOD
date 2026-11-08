import {test} from 'node:test'
import assert from 'node:assert/strict'
import {calculateBulk,DEPOSIT_NOTICE,BULK_PROMOTION} from '../src/utils/bulkPricing.js'
test('serving thresholds choose one discount and simultaneous freeship',()=>{
 for(const [servings,rate,ship] of [[4,0,5000],[5,0,0],[9,0,0],[10,6,0],[19,6,0],[20,8,0],[29,8,0],[30,12,0]]){
  const p=calculateBulk(600000,servings,5000)
  assert.equal(p.discount_rate,rate);assert.equal(p.shipping_fee,ship)
 }
})
test('whole merchandise discount and50% deposit after discount',()=>{
 assert.deepEqual(calculateBulk(600000,10,5000),{eligible_servings:10,discount_rate:6,discount_amount:36000,shipping_fee:0,total_amount:564000,deposit_amount:282000,cod_due:282000})
 assert.equal(calculateBulk(100025,10).discount_amount,6002)
})
test('exact500k threshold, odd amount and shipping contribute to deposit',()=>{
 assert.equal(calculateBulk(499999,0).deposit_amount,0)
 assert.equal(calculateBulk(500000,0).deposit_amount,250000)
 const odd=calculateBulk(500001,0)
 assert.equal(odd.deposit_amount,250001);assert.equal(odd.cod_due,250000)
 assert.equal(calculateBulk(495000,0,5000).deposit_amount,250000)
 assert.equal(calculateBulk(10000,5,5000).shipping_fee,0)
})
test('required wording retained',()=>{
 assert(DEPOSIT_NOTICE.includes('0866451723, ngân hàng MB Bank'))
 assert(DEPOSIT_NOTICE.includes('chờ nhân viên căn tin gọi điện thoại xác nhận lại'))
 assert(BULK_PROMOTION.includes('từ 5 suất ăn'))
})
