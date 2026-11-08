import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderingTimeError, scheduleBounds, scheduleInstant, vietnamDateTime } from '../src/utils/orderingTime.js'
const policy={open_time:'07:30',order_cutoff_time:'18:30',close_time:'19:00',min_lead_minutes:30,max_days:7,exempt_hours:false}
const at=(time)=>scheduleInstant(`2026-11-08T${time}`)
test('immediate exact cutoff, no30-minute wait',()=>{
 assert.equal(orderingTimeError(policy,at('07:30:00'),false), '')
 assert.equal(orderingTimeError(policy,at('18:30:00'),false), '')
 assert.ok(orderingTimeError(policy,at('18:30:00')+1,false))
 assert.ok(orderingTimeError(policy,at('07:29:59'),false))
})
test('after-hours preorder bounds and receipt hours use Vietnam regardless of device timezone',()=>{
 const now=at('22:00:00')
 assert.equal(orderingTimeError(policy,now,true,'2026-11-09T09:00'),'')
 assert.deepEqual(scheduleBounds(policy,now),{min:'2026-11-09T07:30',max:'2026-11-15T19:00'})
 assert.ok(orderingTimeError(policy,now,true,'2026-11-09T07:29'))
 assert.equal(vietnamDateTime(Date.parse('2026-11-08T17:00:00Z')),'2026-11-09T00:00:00')
})
test('seven calendar days, inclusive19:00, lead30 and configured45',()=>{
 assert.equal(orderingTimeError(policy,at('07:30:00'),true,'2026-11-15T19:00'),'')
 assert.ok(orderingTimeError(policy,at('07:30:00'),true,'2026-11-16T07:30'))
 assert.ok(orderingTimeError(policy,at('07:30:00'),true,'2026-11-15T19:00:01'))
 assert.equal(orderingTimeError(policy,at('18:30:00'),true,'2026-11-08T19:00'),'')
 assert.ok(orderingTimeError({...policy,min_lead_minutes:45},at('18:30:00'),true,'2026-11-08T19:00'))
})
test('tester only exempts hours, missing policy blocks',()=>{
 const tester={...policy,exempt_hours:true}
 assert.equal(orderingTimeError(tester,at('23:00:00'),false),'')
 assert.equal(orderingTimeError(tester,at('23:00:00'),true,'2026-11-08T23:30'),'')
 assert.ok(orderingTimeError(tester,at('23:00:00'),true,'2026-11-08T23:10'))
 assert.ok(orderingTimeError(tester,at('23:00:00'),true,'2026-11-16T23:30'))
 assert.ok(orderingTimeError(null,at('11:00:00'),false))
})
