import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/pages/staff/staffRules.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { validateShiftDraft, shiftComparison, shiftSnapshotChanged, MAX_SHIFT_AMOUNT } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const today = '2026-10-30'
const summary = { staff_id: 3, shift_date: today, total_orders_handled: 2, expected_cash: 100000, expected_qr: 50000, actual_cash: 0, actual_qr: 0, discrepancy_amount: 0, status: null }

test('matching cash and QR can be submitted without explanation', () => {
  assert.equal(validateShiftDraft(summary, '100000', '50000', '', today), '')
  assert.deepEqual(shiftComparison(summary, 100000, 50000), { cash: 0, qr: 0, total: 0, needsExplanation: false })
})
test('EX-20 requires a non-blank note for a shortage or surplus', () => {
  for (const cash of ['90000', '110000']) {
    assert.notEqual(validateShiftDraft(summary, cash, '50000', '  ', today), '')
    assert.equal(validateShiftDraft(summary, cash, '50000', 'Đã kiểm đếm, bổ sung giải trình.', today), '')
  }
})
test('offsetting cash and QR differences still require explanation', () => {
  assert.deepEqual(shiftComparison(summary, 90000, 60000), { cash: -10000, qr: 10000, total: 0, needsExplanation: true })
  assert.notEqual(validateShiftDraft(summary, '90000', '60000', '', today), '')
})
test('missing or invalid system data cannot be treated as a zero-value shift', () => {
  assert.notEqual(validateShiftDraft(null, '0', '0', '', today), '')
  assert.notEqual(validateShiftDraft({ ...summary, expected_cash: NaN }, '0', '0', 'Giải trình', today), '')
})
test('amounts must be present, finite, nonnegative and within API limits', () => {
  for (const cash of ['', ' ', '-1', 'NaN', 'Infinity', '10000000000']) {
    assert.notEqual(validateShiftDraft(summary, cash, '50000', 'Giải trình', today), '')
  }
  assert.equal(validateShiftDraft({ ...summary, expected_cash: MAX_SHIFT_AMOUNT }, String(MAX_SHIFT_AMOUNT), '50000', '', today), '')
})
test('two-decimal amounts are supported without thousand-dong rounding', () => {
  const s = { ...summary, expected_cash: 100000.01, expected_qr: 50000.25 }
  assert.equal(validateShiftDraft(s, '100000.01', '50000.25', '', today), '')
  assert.notEqual(validateShiftDraft(s, '100000.001', '50000.25', 'Giải trình', today), '')
})
test('only open shifts for the current Vietnam day can be submitted', () => {
  assert.notEqual(validateShiftDraft({ ...summary, status: 'DA_CHOT' }, '100000', '50000', '', today), '')
  assert.notEqual(validateShiftDraft(summary, '100000', '50000', '', '2026-10-31'), '')
  for (const status of ['CHO_DUYET', 'CAN_GIAI_TRINH']) assert.equal(validateShiftDraft({ ...summary, status }, '100000', '50000', '', today), '')
})
test('explanation length matches the existing API contract', () => {
  assert.equal(validateShiftDraft(summary, '90000', '50000', 'x'.repeat(1000), today), '')
  assert.notEqual(validateShiftDraft(summary, '90000', '50000', 'x'.repeat(1001), today), '')
})
test('a shared-account update or newly handed-over order requires another review', () => {
  assert.equal(shiftSnapshotChanged({ ...summary }, summary), false)
  assert.equal(shiftSnapshotChanged({ ...summary, status: undefined }, summary), false)
  for (const patch of [{ expected_cash: 110000 }, { expected_qr: 60000 }, { total_orders_handled: 3 }, { actual_cash: 100000 }, { actual_qr: 50000 }, { discrepancy_note: 'Phiên khác vừa cập nhật' }, { status: 'CHO_DUYET' }, { shift_date: '2026-10-31' }]) {
    assert.equal(shiftSnapshotChanged({ ...summary, ...patch }, summary), true)
  }
})
