import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../public/auth-navigation.js', import.meta.url), 'utf8')
function setup(next = '/') {
  const local = new Map()
  const session = new Map()
  const context = {
    URL, URLSearchParams,
    location: { origin: 'http://localhost:5173', search: `?next=${encodeURIComponent(next)}`, replace() {} },
    localStorage: { getItem: (key) => local.get(key) || null },
    sessionStorage: { getItem: (key) => session.get(key) || null },
    document: { querySelectorAll: () => [] },
    window: {},
  }
  vm.runInNewContext(source, context)
  return { window: context.window, local, session }
}

test('the role saved after login selects the correct workspace', () => {
  for (const [role, path] of Object.entries({ admin: '/admin', manager: '/quan-ly', staff: '/nhan-vien', customer: '/' })) {
    const { window, session } = setup()
    session.set('neufood_user', JSON.stringify({ role }))
    assert.equal(window.authDestination, path)
  }
})

test('an admin can return to an admin subpage with its query', () => {
  const { window, local } = setup('/admin/tai-khoan?search=abc')
  local.set('neufood_user', JSON.stringify({ role: 'admin' }))
  assert.equal(window.authDestination, '/admin/tai-khoan?search=abc')
})

test('cross-role destinations and lookalike workspace paths use the correct home', () => {
  for (const next of ['/admin', '/admin/tai-khoan', '/quan-ly-fake', '/nhan-vien']) {
    const { window, session } = setup(next)
    session.set('neufood_user', JSON.stringify({ role: 'manager' }))
    assert.equal(window.authDestination, '/quan-ly')
  }
})

test('customers cannot be sent into a management workspace', () => {
  const { window, session } = setup('/admin/cau-hinh')
  session.set('neufood_user', JSON.stringify({ role: 'customer' }))
  assert.equal(window.authDestination, '/')
})

test('customer checkout destinations are preserved', () => {
  const { window } = setup('/thanh-toan?from=cart#payment')
  assert.equal(window.authDestination, '/thanh-toan?from=cart#payment')
})

test('external and authentication destinations cannot redirect off-site or loop', () => {
  for (const next of ['https://example.com/admin', '//example.com', '/DANGNHAP.html', '/dang-nhap']) {
    assert.equal(setup(next).window.authDestination, '/')
  }
})
