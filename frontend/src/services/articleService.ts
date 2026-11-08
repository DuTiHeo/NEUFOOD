import api from './api'
export const articleKinds={recruitment:'Tuyển dụng',story:'Câu chuyện NEUFood',announcement:'Thông báo Canteen',news:'Tin tức và hoạt động'}
export const articleStates={draft:'Bản nháp',published:'Đã xuất bản',hidden:'Đã ẩn'}
export interface RichNode {type:string; text?:string; attrs?:Record<string,any>; marks?:{type:string;attrs?:Record<string,any>}[];content?:RichNode[]}
export interface ArticleContent {title:string;summary:string;cover_url:string;body:RichNode;recruitment_roles:{position:string;description:string}[]}
export interface PublicArticle {id:string;kind:keyof typeof articleKinds;content:ArticleContent;published_at:string|null}
export interface ManagedArticle extends PublicArticle {draft:ArticleContent;status:keyof typeof articleStates;version:number;blocked_by_admin:boolean;hidden_reason:string;created_by:number|null;updated_by:number|null;created_at:string;updated_at:string}
export interface PositionSetting {position:string;is_open:boolean;version:number}
export interface RecruitmentSettings {positions:PositionSetting[];hourly_pay:number;min_weekly_sessions:number;shifts:{morning:string;afternoon:string}}
export const articlePath=(article:PublicArticle)=>article.kind==='recruitment'?'/recruit':article.kind==='story'?'/story':`/bai-viet/${article.id}`
export const emptyArticle=():ArticleContent=>({title:'',summary:'',cover_url:'',body:{type:'doc',content:[{type:'paragraph'}]},recruitment_roles:[]})
const base='/articles'
export const articleService={
 async list(page=1,kind=''):Promise<{items:PublicArticle[];total:number}>{return (await api.get(base,{params:{page,kind,limit:12}})).data.data},
 async detail(id:string):Promise<PublicArticle>{return (await api.get(`${base}/${id}`)).data.data},
 async featured(kind:'story'|'recruitment'):Promise<PublicArticle|null>{return (await api.get(`${base}/featured/${kind}`)).data.data},
 async settings():Promise<RecruitmentSettings>{return (await api.get(`${base}/recruitment-settings`)).data.data},
 async position(item:PositionSetting):Promise<PositionSetting>{return (await api.patch(`${base}/positions/${item.position}`,{is_open:!item.is_open,expected_version:item.version})).data.data},
 async manage(page=1,status='',kind=''):Promise<{items:ManagedArticle[];total:number}>{return (await api.get(`${base}/manage`,{params:{page,status,kind}})).data.data},
 async get(id:string):Promise<ManagedArticle>{return (await api.get(`${base}/manage/${id}`)).data.data},
 async create(kind:string,content:ArticleContent):Promise<ManagedArticle>{return (await api.post(`${base}/manage`,{kind,content})).data.data},
 async save(article:ManagedArticle,content:ArticleContent):Promise<ManagedArticle>{return (await api.put(`${base}/manage/${article.id}`,{content,expected_version:article.version})).data.data},
 async action(article:ManagedArticle,action:'publish'|'hide'|'release',reason=''):Promise<ManagedArticle>{return (await api.post(`${base}/manage/${article.id}/${action}`,{expected_version:article.version,reason})).data.data},
 async history(id:string):Promise<{id:number;actor_id:number|null;action:string;created_at:string}[]>{return (await api.get(`${base}/manage/${id}/history`)).data.data},
 async upload(file:File):Promise<string>{const data=new FormData();data.append('file',file);return (await api.post(`${base}/images`,data,{headers:{'Content-Type':'multipart/form-data'}})).data.data.image_url},
}
