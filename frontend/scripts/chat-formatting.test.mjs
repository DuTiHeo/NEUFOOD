import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/utils/chatFormatting.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const { formatChatLine } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const visible = (line) => formatChatLine(line).parts.map(p => p.text).join('')

test('headings and malformed dish recommendations hide Markdown delimiters', () => {
  const heading = formatChatLine('### 🌟 Các món Cơm Hộp')
  assert.equal(heading.parts[0].bold, true)
  assert.equal(visible('### 🌟 Các món Cơm Hộp'), '🌟 Các món Cơm Hộp')
  const line = '* **Cơm Gà Xối Mỡ Da Giòn:** 45.000đ**'
  assert.equal(formatChatLine(line).list, true)
  assert.equal(visible(line), 'Cơm Gà Xối Mỡ Da Giòn: 45.000đ')
  assert.equal(visible('***Cơm Tấm***: **55.000đ**'), 'Cơm Tấm: 55.000đ')
})
test('preserves dish names, prices, inline hashtags and literal HTML text', () => {
  assert.equal(visible('Giá **45.000đ** #NEUFood'), 'Giá 45.000đ #NEUFood')
  assert.equal(visible('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>')
  assert.equal(visible('2 * 45.000đ'), '2 * 45.000đ')
  assert.equal(visible(''), '')
})
