import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/chatService.ts', import.meta.url), 'utf8')
  .replace("import api from './api';", 'const api = globalThis.chatTestApi;')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
globalThis.sessionStorage = new class {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
}()
let requests = []
globalThis.chatTestApi = { post: async (url, body) => {
  requests.push({ url, body })
  return { data: { data: { session_id: body.session_id, action: { type: 'ORDER_CREATED' } } } }
} }
const { chatService, pendingConfirmation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const confirmation = { role: 'bot', text: 'Xác nhận', action: { type: 'ORDER_CONFIRMATION', draft_id: 'a'.repeat(32), revision: 2 } }

test('confirmation always uses latest draft revision and stops after invalidation', () => {
  assert.equal(pendingConfirmation([confirmation]).revision, 2)
  assert.equal(pendingConfirmation([confirmation, { role: 'bot', action: { type: 'ORDER_COLLECTING' } }]), null)
  assert.equal(pendingConfirmation([confirmation, { role: 'bot', action: { type: 'ORDER_CREATED' } }]), null)
})
test('send carries consent version and strips action metadata from history', async () => {
  await chatService.sendMessage('Đồng ý đặt đơn', [confirmation], 'confirm')
  assert.equal(requests.at(-1).body.revision, 2)
  assert.equal(requests.at(-1).body.decision, 'confirm')
  assert.deepEqual(requests.at(-1).body.history, [{ role: 'bot', text: 'Xác nhận' }])
})
test('account chat history and sessions are isolated', () => {
  chatService.setOwner(1)
  chatService.saveStoredMessages([confirmation])
  const first = chatService.getSessionId()
  chatService.setOwner(2)
  assert.deepEqual(chatService.loadStoredMessages(), [])
  assert.notEqual(chatService.getSessionId(), first)
  chatService.setOwner(1)
  assert.equal(chatService.loadStoredMessages().length, 1)
})
test('failed reset still clears local chat and rotates the session', async () => {
  globalThis.chatTestApi.post = async () => { throw Error('offline') }
  const before = chatService.getSessionId()
  assert.equal(await chatService.resetChat(), false)
  assert.notEqual(chatService.getSessionId(), before)
  assert.equal(chatService.loadStoredMessages().length, 0)
})
test('logout invalidation removes old confirmation and rotates its account session', () => {
  chatService.setOwner(1)
  chatService.saveStoredMessages([confirmation])
  const old = chatService.getSessionId()
  chatService.setOwner(2)
  const other = chatService.getSessionId()
  chatService.invalidateOwnerSession(1)
  assert.equal(chatService.getSessionId(), other)
  chatService.setOwner(1)
  assert.notEqual(chatService.getSessionId(), old)
  assert.equal(pendingConfirmation(chatService.loadStoredMessages()), null)
})
