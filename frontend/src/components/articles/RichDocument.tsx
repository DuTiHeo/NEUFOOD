import { Fragment, type ReactNode } from 'react'
import type { RichNode } from '../../services/articleService'
import styles from './Articles.module.css'
function safe(value:unknown){return typeof value==='string'&&(/^(https?:)\/\//i.test(value)||value.startsWith('/uploads/'))&&!value.startsWith('//')?value:undefined}
function render(node:RichNode,key:number|string):ReactNode {
 const children=node.content?.map((child,i)=>render(child,i))
 switch(node.type){
 case 'text': {let text:ReactNode=node.text || '';for(const mark of node.marks || []){if(mark.type==='bold')text=<strong>{text}</strong>;else if(mark.type==='italic')text=<em>{text}</em>;else if(mark.type==='link'&&safe(mark.attrs?.href))text=<a href={safe(mark.attrs?.href)} target="_blank" rel="noopener noreferrer">{text}</a>};return <Fragment key={key}>{text}</Fragment>}
 case 'doc':return <Fragment key={key}>{children}</Fragment>
 case 'paragraph':return <p key={key}>{children || <br />}</p>
 case 'heading':return node.attrs?.level===3?<h3 key={key}>{children}</h3>:<h2 key={key}>{children}</h2>
 case 'bulletList':return <ul key={key}>{children}</ul>
 case 'orderedList':return <ol key={key} start={node.attrs?.start || 1}>{children}</ol>
 case 'listItem':return <li key={key}>{children}</li>
 case 'blockquote':return <blockquote key={key}>{children}</blockquote>
 case 'hardBreak':return <br key={key}/>
 case 'horizontalRule':return <hr key={key}/>
 case 'image':return safe(node.attrs?.src)?<img key={key} src={safe(node.attrs?.src)} alt={node.attrs?.alt || ''} title={node.attrs?.title || undefined} loading="lazy"/>:null
 default:return null
 }
}
export default function RichDocument({document}:{document:RichNode}){return <div className={styles.document}>{render(document,'root')}</div>}
