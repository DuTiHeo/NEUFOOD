import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const html = readFileSync(new URL('../public/RANDOM.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]

async function wheel(responses) {
  const elements = new Map()
  const canvas = new Proxy({}, { get: () => () => {} })
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      style: {}, classList: { add() {}, remove() {} }, children: [],
      getContext: () => canvas, addEventListener() {},
      appendChild(child) { this.children.push(child) },
      replaceChildren() { this.children = [] },
    })
    return elements.get(id)
  }
  const store = () => {
    const data = new Map()
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  }
  const calls = []
  const context = vm.createContext({
    document: { getElementById: element, createElement: () => element(Symbol()), querySelectorAll: () => [] },
    window: { location: { href: '' }, addEventListener() {} },
    localStorage: store(), sessionStorage: store(), setTimeout, console,
    getComputedStyle: () => ({ getPropertyValue: () => '#1583e4' }),
    fetch: async url => {
      calls.push(url)
      const data = responses[url]
      return { ok: data !== undefined, json: async () => ({ success: true, data }) }
    },
  })
  await vm.runInContext(script, context)
  return { context, element, calls, run: source => vm.runInContext(source, context) }
}

const rice = { id: 'com-tron', name: 'Cơm Trộn Hàn Quốc mới', image_url: '/uploads/current-rice.jpg', category_ids: ['rice'], is_available: true }
const combo = { id: 'combo-3-nguoi', name: 'Combo 3 Người', image: '/combo.jpg', category_ids: ['combo'] }
const categories = [{ id: 'rice', name: 'Cơm' }, { id: 'combo', name: 'Combo' }]
const responses = items => ({ '/api/v1/dishes/categories': categories, '/api/v1/dishes?page=1&limit=100': { items, total: items.length } })

test('uses current API names/images, excludes unavailable/inactive/deleted dishes and filters categories', async () => {
  const app = await wheel(responses([rice, combo,
    { ...rice, id: 'sold-out', is_available: false },
    { ...rice, id: 'inactive', is_active: false },
    { ...rice, id: 'deleted', is_deleted: true },
  ]))
  assert.equal(app.run('menuData["Tất cả các món"].length'), 2)
  assert.equal(app.run('menuData["Cơm"][0].name'), rice.name)
  assert.equal(app.run('menuData["Cơm"][0].img'), rice.image_url)
  assert.equal(app.element('spin-btn').disabled, false)
})

test('existing button opens the exact dish/combo details without modifying either cart or pending additions', async () => {
  const app = await wheel(responses([rice, combo]))
  app.context.localStorage.setItem('neufood-cart-v1', '{"banh-mi":2}')
  app.context.localStorage.setItem('neufood-cart-v2', '[{"dishId":"banh-mi","qty":2}]')
  app.context.sessionStorage.setItem('neufood-cart-pending-v1', '{"adds":{"banh-mi":1}}')
  for (const [index, id] of [[0, rice.id], [1, combo.id]]) {
    app.run(`showResult(menuData["Tất cả các món"][${index}]); orderNow()`)
    assert.equal(app.context.window.location.href, '/mon/' + id)
  }
  assert.equal(app.context.localStorage.getItem('neufood-cart-v1'), '{"banh-mi":2}')
  assert.equal(app.context.localStorage.getItem('neufood-cart-v2'), '[{"dishId":"banh-mi","qty":2}]')
  assert.equal(app.context.sessionStorage.getItem('neufood-cart-pending-v1'), '{"adds":{"banh-mi":1}}')
  app.run('lastWinningItem = {id: "special/id"}; orderNow()')
  assert.equal(app.context.window.location.href, '/mon/special%2Fid')
})

test('loads subsequent menu pages', async () => {
  const data = responses([rice])
  data['/api/v1/dishes?page=1&limit=100'].total = 101
  data['/api/v1/dishes?page=2&limit=100'] = { items: [combo], total: 101 }
  const app = await wheel(data)
  assert.ok(app.calls.includes('/api/v1/dishes?page=2&limit=100'))
  assert.equal(app.run('menuData["Tất cả các món"].length'), 2)
})

test('empty or failed menu blocks spins instead of using stale hardcoded dishes', async () => {
  for (const data of [responses([]), {}, { '/api/v1/dishes/categories': categories }]) {
    const app = await wheel(data)
    assert.equal(app.element('spin-btn').disabled, true)
    assert.ok(app.element('menu-status').textContent)
    app.run('spinBtn.onclick()')
    assert.equal(app.run('isSpinning'), false)
  }
})

test('broken image uses the shared placeholder without an error loop', async () => {
  const app = await wheel(responses([rice]))
  app.run('showResult(menuData["Tất cả các món"][0])')
  const image = app.element('food-img')
  assert.equal(image.alt, rice.name)
  image.onerror()
  assert.equal(image.src, '/dish-placeholder.svg')
  assert.equal(image.onerror, null)
})
