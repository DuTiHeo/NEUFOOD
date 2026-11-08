import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const source=readFileSync(new URL('../src/components/articles/RichDocument.tsx',import.meta.url),'utf8').replace("import styles from './Articles.module.css'",'const styles={document:"document"}')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
const module={exports:{}}
new Function('require','module','exports',compiled)(createRequire(import.meta.url),module,module.exports)
const render=document=>renderToStaticMarkup(createElement(module.exports.default,{document}))
test('rich article text stays escaped and script nodes never render',()=>{
 const html=render({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'<script>alert(1)</script>'}]},{type:'script',text:'alert(2)'}]})
 assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'))
})
test('links and images reject executable URLs even in unsaved preview',()=>{
 const html=render({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'unsafe',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},{type:'image',attrs:{src:'data:image/svg+xml,test'}}]})
 assert(!html.includes('href='));assert(!html.includes('<img'))
})
test('bold italic headings and safe links/images preserve formatting',()=>{
 const html=render({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Tiêu đề'}]},{type:'paragraph',content:[{type:'text',text:'Nội dung',marks:[{type:'bold'},{type:'italic'},{type:'link',attrs:{href:'https://www.neu.edu.vn'}}]}]},{type:'image',attrs:{src:'/uploads/test.png',alt:'Ảnh'}}]})
 for(const text of ['<h2>Tiêu đề</h2>','<strong>','<em>','href="https://www.neu.edu.vn"','noopener noreferrer','src="/uploads/test.png"'])assert(html.includes(text))
})
