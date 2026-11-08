import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addCartLine, restoreCart, resolveCartLine, cartQuantity } from '../src/utils/cartLines.js'
import { defaultPortions, resolvePortions, portionSummary } from '../src/utils/portions.js'
const sql = readFileSync(new URL('../../database/extra_portions.sql', import.meta.url), 'utf8')
const catalogs = Object.fromEntries([...sql.matchAll(/SET portion_groups = '(.*?)'::jsonb WHERE id = '([^']+)'/g)].map(([,raw,id])=>[id, JSON.parse(raw.replaceAll("''", "'"))]))
const bread = {id:'banh-mi', price:25000, is_available:true, portion_groups:catalogs['banh-mi']}
const pate = defaultPortions(bread.portion_groups)
pate[0].addon_ids = ['banh-mi-3']
test('different configurations stay separate and quantity aggregates',()=>{
 let rows=addCartLine([],bread,1,10,{portions:pate})
 rows=addCartLine(rows,bread,1,10)
 assert.equal(rows.length,2)
 assert.equal(cartQuantity(rows,'banh-mi'),2)
 assert.equal(rows.reduce((s,r)=>s+r.unitPrice*r.qty,0),55000)
 assert.equal(addCartLine(rows,bread,9,10),rows)
 rows=addCartLine(rows,bread,-1,10)
 assert.equal(rows.length,1)
 assert.equal(rows[0].unitPrice,30000)
})
test('identical choices merge but notes and combo slots remain distinct',()=>{
 let rows=addCartLine([],bread,1,10,{portions:pate,note:'Không ớt'})
 rows=addCartLine(rows,bread,1,10,{portions:pate,note:'Không ớt'})
 assert.equal(rows.length,1);assert.equal(rows[0].qty,2)
 rows=addCartLine(rows,bread,1,10,{portions:pate,note:'Ít ớt'})
 assert.equal(rows.length,2)
})
test('legacy cart migrates without losing quantities',()=>{
 const rows=restoreCart(null,JSON.stringify({'banh-mi':2}))
 const line=resolveCartLine(rows[0],bread)
 assert.equal(line.qty,2);assert.equal(line.unitPrice,25000);assert.equal(line.invalidReason,'')
})
test('stale price blocks until explicit review, removed extras never silently disappear',()=>{
 const row=addCartLine([],bread,1,10,{portions:pate})[0]
 const changed=structuredClone(bread);changed.price=26000
 const line=resolveCartLine(row,changed)
 assert.ok(line.invalidReason);assert.equal(line.canReview,true);assert.equal(line.unitPrice,30000);assert.equal(line.currentUnitPrice,31000)
 changed.portion_groups=[]
 assert.ok(resolveCartLine(row,changed).invalidReason)
 assert.ok(resolveCartLine(row,bread,'offline').invalidReason)
})
test('three combo servings add rice once each, two combos multiply once',()=>{
 const groups=catalogs['combo-3-nguoi']; const selections=defaultPortions(groups)
 for (const s of selections.filter(s=>s.slot_id.startsWith('main-'))) s.addon_ids=[groups.find(g=>g.id===s.slot_id).choices[0].addons[0].id]
 assert.equal(resolvePortions(groups,selections).extraPrice,15000)
 const rows=addCartLine([],{id:'combo-3-nguoi',price:205000,portion_groups:groups},2,10,{portions:selections})
 assert.equal(rows[0].unitPrice*rows[0].qty,440000)
 assert.ok(portionSummary(rows[0].snapshot).includes('5k'))
 const duplicate=structuredClone(selections);duplicate[0].addon_ids.push(duplicate[0].addon_ids[0])
 assert.throws(()=>resolvePortions(groups,duplicate))
})
test('combo2 independently chooses mains; canned drinks have no groups',()=>{
 const groups=catalogs['combo-2-nguoi'];const selections=defaultPortions(groups)
 selections[1].choice_id='bun-cha'
 const result=resolvePortions(groups,selections)
 assert.equal(result.snapshot[0].choice_id,'com-tam');assert.equal(result.snapshot[1].choice_id,'bun-cha')
 assert.deepEqual(catalogs.pepsi,[]);assert.deepEqual(catalogs['coca-cola'],[])
})
