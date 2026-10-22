import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/orders.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { canHandover, allowedIssues, orderStatusLabels, orderError, formatOrderTime } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
const heldUntil = '2026-10-19T05:30:00+00:00'
const sample = { order_type: 'delivery', status: 'DANG_GIAO', payment_status: 'chua_thanh_toan', pickup_deadline: heldUntil }

test('Only unpaid orders in the correct delivery/pickup state can be handed over', () => {
  for (const status of Object.keys(orderStatusLabels)) {
    for (const order_type of ['delivery', 'pickup']) {
      const expected = order_type === 'delivery' ? ['DANG_GIAO', 'GIAO_THAT_BAI'].includes(status) : status === 'SAN_SANG_LAY'
      assert.equal(canHandover({ ...sample, order_type, status }), expected, order_type + ' ' + status)
      assert.equal(canHandover({ ...sample, order_type, status, payment_status: 'da_thanh_toan' }), false)
    }
  }
})
test('No-answer is offered only while delivering; timeout only strictly after the hold deadline', () => {
  const deadline = Date.parse(heldUntil)
  assert.deepEqual(allowedIssues(sample, deadline + 1), ['no_answer', 'refuse_payment'])
  for (const [order_type, status] of [['delivery', 'GIAO_THAT_BAI'], ['pickup', 'SAN_SANG_LAY']]) {
    const order = { ...sample, order_type, status }
    assert.deepEqual(allowedIssues(order, deadline), ['refuse_payment'])
    assert.deepEqual(allowedIssues(order, deadline + 1), ['refuse_payment', 'pickup_timeout'])
    assert.deepEqual(allowedIssues({ ...order, pickup_deadline: null }, deadline + 1), ['refuse_payment'])
  }
  assert.deepEqual(allowedIssues({ ...sample, status: 'DA_GIAO', payment_status: 'da_thanh_toan' }), [])
})
test('Errors keep server business messages and validation details; display time uses Vietnam', () => {
  assert.equal(orderError({ response: { data: { message: 'Sai mã đối chiếu', errors: [{ code: 'EX-17' }] } } }), 'Sai mã đối chiếu')
  assert.equal(orderError({ response: { data: { message: 'Dữ liệu sai', errors: [{ msg: 'Cần 4 chữ số' }] } } }), 'Dữ liệu sai: Cần 4 chữ số')
  assert.match(orderError(new Error('network')), /Không thể kết nối/)
  assert.equal(orderError({ response: { data: { message: 'Không hợp lệ', errors: {} } } }), 'Không hợp lệ')
  assert.match(formatOrderTime(heldUntil), /12:30/)
  assert.equal(formatOrderTime(null), '—')
})
