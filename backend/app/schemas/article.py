import json
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal

KINDS = ('recruitment','story','announcement','news')
ROLES = ('shipper','packing','customer_support','communications')


def safe_url(value, image=False):
    if not isinstance(value, str) or len(value)>2000 or any(c.isspace() or ord(c)<32 for c in value) or '\\' in value:
        raise ValueError('Đường dẫn không hợp lệ')
    if value.startswith('/uploads/') and '..' not in value and not value.startswith('//'):
        return value
    parsed=urlsplit(value)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError('Chỉ chấp nhận đường dẫn HTTP/HTTPS hoặc ảnh đã tải lên')
    return value


def validate_document(document):
    count=0
    def node(item,depth=0):
        nonlocal count
        count+=1
        if depth>12 or count>2000 or not isinstance(item,dict):raise ValueError('Nội dung quá lớn hoặc không hợp lệ')
        kind=item.get('type')
        if kind not in ('doc','paragraph','heading','text','hardBreak','bulletList','orderedList','listItem','blockquote','image','horizontalRule'):
            raise ValueError('Định dạng nội dung không hỗ trợ')
        if set(item)-{'type','text','attrs','marks','content'}:raise ValueError('Nội dung có thuộc tính không hỗ trợ')
        result={'type':kind}
        attrs=item.get('attrs') or {}
        if not isinstance(attrs,dict):raise ValueError('Thuộc tính không hợp lệ')
        if kind=='heading':
            if attrs.get('level') not in (2,3):raise ValueError('Nội dung chỉ dùng tiêu đề cấp2/3')
            result['attrs']={'level':attrs['level']}
        elif kind=='image':
            result['attrs']={'src':safe_url(attrs.get('src'),True),'alt':str(attrs.get('alt') or '')[:200],'title':str(attrs.get('title') or '')[:200]}
        elif kind=='orderedList':
            start=attrs.get('start',1)
            if type(start)!=int or not 1<=start<=10000:raise ValueError('Danh sách không hợp lệ')
            result['attrs']={'start':start}
        elif attrs:raise ValueError('Thuộc tính không được phép')
        if kind=='text':
            value=item.get('text')
            if not isinstance(value,str) or len(value)>20000:raise ValueError('Đoạn văn không hợp lệ')
            result['text']=value
        elif 'text' in item:raise ValueError('Nội dung không hợp lệ')
        marks=item.get('marks',[])
        if not isinstance(marks,list) or len(marks)>3:raise ValueError('Định dạng chữ không hợp lệ')
        if marks and kind!='text':raise ValueError('Định dạng chỉ áp dụng cho chữ')
        cleaned=[]
        for mark in marks:
            if not isinstance(mark,dict) or mark.get('type') not in ('bold','italic','link'):raise ValueError('Định dạng chữ không hỗ trợ')
            m={'type':mark['type']}
            if mark['type']=='link':
                link_attrs=mark.get('attrs') or {}
                if not isinstance(link_attrs,dict):raise ValueError('Liên kết không hợp lệ')
                m['attrs']={'href':safe_url(link_attrs.get('href'))}
            cleaned.append(m)
        if cleaned:result['marks']=cleaned
        children=item.get('content',[])
        if not isinstance(children,list):raise ValueError('Nội dung con không hợp lệ')
        if kind in ('text','hardBreak','horizontalRule','image') and children:raise ValueError('Định dạng không thể có nội dung con')
        allowed={'doc':{'paragraph','heading','bulletList','orderedList','blockquote','image','horizontalRule'},
            'paragraph':{'text','hardBreak'},'heading':{'text','hardBreak'},
            'bulletList':{'listItem'},'orderedList':{'listItem'},
            'listItem':{'paragraph','bulletList','orderedList'},
            'blockquote':{'paragraph','heading','bulletList','orderedList'}}
        if any(not isinstance(child,dict) or child.get('type') not in allowed.get(kind,set()) for child in children):
            raise ValueError('Cấu trúc nội dung không hợp lệ')
        if children:result['content']=[node(child,depth+1) for child in children]
        return result
    if not isinstance(document,dict) or document.get('type')!='doc':raise ValueError('Nội dung phải là tài liệu')
    cleaned=node(document)
    if len(json.dumps(cleaned,ensure_ascii=False))>150000:raise ValueError('Bài viết quá dài')
    return cleaned


class RecruitmentBlock(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    position: Literal['shipper','packing','customer_support','communications']
    description: str=Field(default='',max_length=3000)


class ArticleContent(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    title: str=Field(default='',max_length=200)
    summary: str=Field(default='',max_length=600)
    cover_url: str=Field(default='',max_length=2000)
    body: dict=Field(default_factory=lambda:{'type':'doc','content':[{'type':'paragraph'}]})
    recruitment_roles: list[RecruitmentBlock]=Field(default_factory=list,max_length=4)
    @field_validator('body')
    @classmethod
    def body_safe(cls,value):return validate_document(value)
    @field_validator('cover_url')
    @classmethod
    def cover_safe(cls,value):return safe_url(value,True) if value else ''


class ArticleCreate(BaseModel):
    model_config=ConfigDict(extra='forbid')
    kind: Literal['recruitment','story','announcement','news']
    content: ArticleContent


class ArticleEdit(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_version: int=Field(strict=True,ge=1)
    content: ArticleContent


class ArticleAction(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    expected_version: int=Field(strict=True,ge=1)
    reason: str=Field(default='',max_length=1000)


class PositionEdit(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_version: int=Field(strict=True,ge=1)
    is_open: bool=Field(strict=True)
