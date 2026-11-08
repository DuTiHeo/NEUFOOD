import { useEffect,useState } from 'react'
import { useEditor,EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { articleService,type RichNode } from '../../services/articleService'
import styles from './Articles.module.css'
export default function RichEditor({value,onChange,disabled=false}:{value:RichNode;onChange:(document:RichNode)=>void;disabled?:boolean}){
 const [link,setLink]=useState('');const [image,setImage]=useState('');const [error,setError]=useState('');const [uploading,setUploading]=useState(false)
 const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[2,3]},code:false,codeBlock:false,strike:false,underline:false,link:{openOnClick:false,autolink:false,linkOnPaste:false}}),Image.configure({allowBase64:false})],content:value,editable:!disabled,onUpdate:({editor})=>onChange(editor.getJSON() as RichNode),editorProps:{attributes:{'aria-label':'Nội dung bài viết',role:'textbox','aria-multiline':'true'}}})
 useEffect(()=>{editor?.setEditable(!disabled)},[editor,disabled])
 if(!editor)return <p>Đang mở trình soạn thảo…</p>
 const valid=(url:string)=>/^https?:\/\//i.test(url)||url.startsWith('/uploads/')
 const button=(label:string,run:()=>void,active=false)=><button type="button" className={`manager-button ${active?'primary':''}`} aria-pressed={active} disabled={disabled||uploading} onClick={run}>{label}</button>
 async function upload(file?:File){if(!file)return;setError('');setUploading(true);try{const src=await articleService.upload(file);editor!.chain().focus().setImage({src}).run()}catch(e:any){setError(e?.response?.data?.message||'Không tải được ảnh.')}finally{setUploading(false)}}
 return <div className={styles.editor}>
  <div className={styles.toolbar} aria-label="Định dạng bài viết">{button('Đoạn văn',()=>editor.chain().focus().setParagraph().run())}{button('Tiêu đề 2',()=>editor.chain().focus().toggleHeading({level:2}).run(),editor.isActive('heading',{level:2}))}{button('Tiêu đề 3',()=>editor.chain().focus().toggleHeading({level:3}).run(),editor.isActive('heading',{level:3}))}{button('In đậm',()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}{button('In nghiêng',()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}{button('Danh sách',()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}{button('Đánh số',()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}{button('Trích dẫn',()=>editor.chain().focus().toggleBlockquote().run())}{button('Hoàn tác',()=>editor.chain().focus().undo().run())}</div>
  <EditorContent editor={editor} className={styles.inputEditor}/>
  <div className={styles.toolbar}><label>Đường dẫn liên kết<input className="manager-input" type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…"/></label>{button('Chèn liên kết',()=>{if(!valid(link)){setError('Nhập đường dẫn HTTP/HTTPS hợp lệ.');return}editor.chain().focus().extendMarkRange('link').setLink({href:link}).run();setLink('');setError('')})}{button('Gỡ liên kết',()=>editor.chain().focus().unsetLink().run())}</div>
  <div className={styles.toolbar}><label>Đường dẫn ảnh<input className="manager-input" value={image} onChange={e=>setImage(e.target.value)} placeholder="https://… hoặc /uploads/…"/></label>{button('Chèn ảnh',()=>{if(!valid(image)){setError('Nhập đường dẫn ảnh HTTP/HTTPS hợp lệ.');return}editor.chain().focus().setImage({src:image}).run();setImage('');setError('')})}<label>Tải ảnh từ máy<input type="file" accept=".png,.jpg,.jpeg,.webp,.gif" disabled={disabled||uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label></div>
  {uploading&&<p role="status">Đang tải ảnh…</p>}{error&&<p role="alert" className="manager-alert error">{error}</p>}
 </div>
}
