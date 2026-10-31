import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/pages/manager/managerRules.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { orderActions, canCloseShift, shiftDifferences, dateRange, vietnamDate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const now = Date.parse('2026-10-30T08:00:00Z')
const order = (patch = {}) => ({ id: 'NF12340007', status: 'CHO_XAC_NHAN', order_type: 'delivery', payment_status: 'chua_thanh_toan', created_at: '2026-10-30T07:50:00Z', ...patch })
test('BR-16: accept at exactly 10 minutes, block after, including future preorders', () => {
  assert.deepEqual(orderActions(order(), now), ['accept', 'reject'])
  assert.deepEqual(orderActions(order(), now + 1), [])
  assert.deepEqual(orderActions(order({ is_preorder: true, scheduled_at: '2026-10-30T10:00:00Z' }), now + 1), [])
  assert.deepEqual(orderActions(order({ created_at: undefined }), now), [])
  assert.deepEqual(orderActions(order({ created_at: 'invalid' }), now), [])
  assert.deepEqual(orderActions(order({ created_at: '2026-10-30T07:40:00Z' }), now, 30), ['accept', 'reject'])
})
test('BR-18: only unpaid delivery and valid counter states can hand over', () => {
  assert.deepEqual(orderActions(order({ status: 'DANG_GIAO' }), now), ['handover', 'issue'])
  assert.deepEqual(orderActions(order({ status: 'DANG_GIAO', order_type: 'pickup' }), now), [])
  assert.deepEqual(orderActions(order({ status: 'DANG_GIAO', payment_status: 'da_thanh_toan' }), now), [])
  for (const status of ['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH', 'KHIEU_NAI', 'DA_GIAI_QUYET', 'TU_CHOI', 'DA_HUY_KHACH', 'TU_DONG_HUY', 'BO_DON_BLACKLIST']) assert.deepEqual(orderActions(order({ status }), now), [])
})
test('BR-20/21: counter handover accepts exact deadline, blocks after and missing deadline', () => {
  for (const [status, order_type] of [['SAN_SANG_LAY', 'pickup'], ['GIAO_THAT_BAI', 'delivery']]) {
    const o = order({ status, order_type, pickup_deadline: new Date(now).toISOString() })
    assert.deepEqual(orderActions(o, now), ['handover', 'issue'])
    assert.deepEqual(orderActions(o, now + 1), ['issue'])
    assert.deepEqual(orderActions({ ...o, pickup_deadline: null }, now), [])
    assert.deepEqual(orderActions({ ...o, pickup_deadline: 'invalid' }, now), [])
  }
})
const shift = { status: 'CHO_DUYET', expected_cash: 100000, actual_cash: 100000, expected_qr: 50000, actual_qr: 50000, discrepancy_note: null }
test('EX-20: balanced shifts can close; cash/QR differences require an explanation', () => {
  assert.equal(canCloseShift(shift), true)
  const mismatch = { ...shift, actual_cash: 90000 }
  assert.equal(canCloseShift(mismatch), false)
  assert.equal(canCloseShift(mismatch, 'Đã kiểm tra sao kê và giải trình'), true)
  assert.equal(canCloseShift({ ...mismatch, discrepancy_note: 'Nhân viên giải trình' }), true)
  assert.equal(canCloseShift({ ...mismatch, discrepancy_note: ' ' }), false)
  assert.equal(canCloseShift({ ...shift, status: 'DA_CHOT' }, 'Ghi chú'), false)
})
test('cash and QR offsets cannot hide discrepancies behind a zero net total', () => {
  const s = { ...shift, actual_cash: 90000, actual_qr: 60000 }
  assert.deepEqual(shiftDifferences(s), { cash: -10000, qr: 10000, total: 0, hasDifference: true })
  assert.equal(canCloseShift(s), false)
})
test('BR-25: calendar and report periods use Vietnam dates across UTC midnight', () => {
  const d = new Date('2026-10-30T17:15:00Z')
  assert.equal(vietnamDate(d), '2026-10-31')
  assert.deepEqual(dateRange(1, d), { from: '2026-10-31', to: '2026-10-31' })
  assert.deepEqual(dateRange(7, d), { from: '2026-10-25', to: '2026-10-31' })
})
