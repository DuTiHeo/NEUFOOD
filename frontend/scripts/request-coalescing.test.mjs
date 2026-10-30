import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/utils/singleFlight.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { singleFlight } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('concurrent readers send one request', async () => {
  let calls = 0, release
  const read = singleFlight(() => { calls++; return new Promise((resolve) => { release = resolve }) })
  const first = read(), second = read()
  assert.equal(first, second)
  await Promise.resolve()
  assert.equal(calls, 1)
  release(['dish'])
  assert.deepEqual(await second, ['dish'])
})
test('completed reads are fresh on manual refresh', async () => {
  let version = 0
  const read = singleFlight(async () => ++version)
  assert.equal(await read(), 1)
  assert.equal(await read(), 2)
})
test('failed reads do not prevent a later retry', async () => {
  let calls = 0
  const read = singleFlight(async () => { if (++calls === 1) throw Error('429'); return 'recovered' })
  assert.deepEqual((await Promise.allSettled([read(), read()])).map((r) => r.status), ['rejected', 'rejected'])
  assert.equal(calls, 1)
  assert.equal(await read(), 'recovered')
})
test('different sessions do not share protected data', async () => {
  let session = 'first', calls = 0
  const read = singleFlight(async () => ++calls, () => session)
  const first = read()
  session = 'second'
  const second = read()
  assert.notEqual(first, second)
  await Promise.all([first, second])
  assert.equal(calls, 2)
})
