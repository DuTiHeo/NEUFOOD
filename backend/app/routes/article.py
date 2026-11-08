from datetime import datetime,timezone
from pathlib import Path
from flask import Blueprint,request,g
from pydantic import ValidationError
from sqlalchemy import cast,String
from app.core.security import jwt_required
from app.core.limiter import limiter
from app.db.session import get_db
from app.db.models import User
from app.db.article_models import Article,ArticleAudit,RecruitmentPosition
from app.schemas.article import ArticleCreate,ArticleEdit,ArticleAction,PositionEdit,KINDS,ROLES
from app.crud.article import ArticleError,audit,public_article,managed_article,lock_article,update_metadata,publish
from app.utils.helpers import api_response,save_upload_file

article_bp=Blueprint('articles',__name__)


def actor(db,roles=('manager',)):
    user=db.query(User).filter_by(id=int(g.current_user['sub'])).with_for_update(read=True).first()
    if not user or not user.is_active or user.role not in roles:raise ArticleError('Bạn không có quyền thực hiện thao tác này','FORBIDDEN',403)
    return user


def body(schema):
    data=request.get_json(silent=True)
    if not isinstance(data,dict):raise ArticleError('Dữ liệu phải là JSON object','INVALID_ARTICLE',400)
    try:return schema.model_validate(data)
    except ValidationError:raise ArticleError('Tiêu đề, nội dung, ảnh, liên kết hoặc phiên bản bài viết không hợp lệ','INVALID_ARTICLE',422)


def page_args():
    try:
        page,limit=int(request.args.get('page',1)),int(request.args.get('limit',20))
        if page<1 or not 1<=limit<=100:raise ValueError()
        return page,limit
    except ValueError:raise ArticleError('Phân trang không hợp lệ','INVALID_PAGE',400)


def filtered(query,managed=False):
    kind=request.args.get('kind','')
    if kind:
        if kind not in KINDS:raise ArticleError('Loại bài không hợp lệ','INVALID_KIND',400)
        query=query.filter_by(kind=kind)
    q=request.args.get('q','').strip()[:100]
    if q:query=query.filter(cast(Article.draft if managed else Article.published,String).icontains(q,autoescape=True))
    return query


@article_bp.errorhandler(ArticleError)
def failure(error):return api_response(success=False,status_code=error.status,message=str(error),errors=[{'code':error.code}])


@article_bp.route('',methods=['GET'])
@limiter.exempt
def list_public():
    page,limit=page_args()
    with get_db() as db:
        query=filtered(db.query(Article).filter_by(status='published',blocked_by_admin=False))
        total=query.count();items=query.order_by(Article.published_at.desc(),Article.id).offset((page-1)*limit).limit(limit).all()
        return api_response(data={'items':[public_article(a) for a in items],'total':total,'page':page,'limit':limit})


@article_bp.route('/featured/<kind>',methods=['GET'])
@limiter.exempt
def featured(kind):
    if kind not in ('recruitment','story'):raise ArticleError('Loại bài không hợp lệ','INVALID_KIND',400)
    with get_db() as db:
        article=db.query(Article).filter_by(kind=kind,status='published',blocked_by_admin=False).first()
        return api_response(data=public_article(article) if article else None)


@article_bp.route('/recruitment-settings',methods=['GET'])
@limiter.exempt
def recruitment_settings():
    with get_db() as db:
        items=db.query(RecruitmentPosition).order_by(RecruitmentPosition.position).all()
        return api_response(data={'positions':[{'position':p.position,'is_open':p.is_open,'version':p.version} for p in items],'hourly_pay':25000,'min_weekly_sessions':4,'shifts':{'morning':'07:00–12:00','afternoon':'12:00–19:00'}})


@article_bp.route('/<article_id>',methods=['GET'])
@limiter.exempt
def public_detail(article_id):
    with get_db() as db:
        article=db.query(Article).filter_by(id=article_id,status='published',blocked_by_admin=False).first()
        if not article:raise ArticleError('Bài viết không tồn tại hoặc chưa xuất bản','ARTICLE_NOT_FOUND',404)
        return api_response(data=public_article(article))


@article_bp.route('/manage',methods=['GET','POST'])
@jwt_required
@limiter.exempt
def manage_articles():
    with get_db() as db:
        user=actor(db,('manager','admin') if request.method=='GET' else ('manager',))
        if request.method=='POST':
            dto=body(ArticleCreate)
            article=Article(kind=dto.kind,draft=dto.content.model_dump(),created_by=user.id,updated_by=user.id)
            db.add(article);db.flush();audit(db,user,'create',article,{'draft':article.draft})
            result=managed_article(article)
        else:
            page,limit=page_args();query=filtered(db.query(Article),True)
            status=request.args.get('status','')
            if status:
                if status not in ('draft','published','hidden'):raise ArticleError('Trạng thái không hợp lệ','INVALID_STATUS',400)
                query=query.filter_by(status=status)
            total=query.count();items=query.order_by(Article.updated_at.desc(),Article.id).offset((page-1)*limit).limit(limit).all()
            result={'items':[managed_article(a) for a in items],'total':total,'page':page,'limit':limit}
    return api_response(data=result,status_code=201 if request.method=='POST' else 200)


@article_bp.route('/manage/<article_id>',methods=['GET','PUT'])
@jwt_required
@limiter.exempt
def manage_detail(article_id):
    with get_db() as db:
        user=actor(db,('manager','admin') if request.method=='GET' else ('manager',))
        if request.method=='PUT':
            dto=body(ArticleEdit);article=lock_article(db,article_id,dto.expected_version)
            previous=article.draft;article.draft=dto.content.model_dump();update_metadata(article,user)
            db.flush();audit(db,user,'save_draft',article,{'before':previous,'after':article.draft})
        else:
            article=db.get(Article,article_id)
            if not article:raise ArticleError('Không tìm thấy bài viết','ARTICLE_NOT_FOUND',404)
        result=managed_article(article)
    return api_response(data=result)


@article_bp.route('/manage/<article_id>/<action>',methods=['POST'])
@jwt_required
@limiter.exempt
def article_action(article_id,action):
    if action not in ('publish','hide','release'):raise ArticleError('Thao tác không hợp lệ','INVALID_ACTION',400)
    with get_db() as db:
        user=actor(db,('admin',) if action=='release' else ('manager',) if action=='publish' else ('manager','admin'))
        dto=body(ArticleAction);article=lock_article(db,article_id,dto.expected_version,publishing=action=='publish')
        if action=='publish':publish(db,article,user)
        elif action=='hide':
            if user.role=='manager' and article.blocked_by_admin:raise ArticleError('Chỉ Admin được gỡ hoặc thay đổi lệnh chặn này','ARTICLE_ADMIN_BLOCKED',403)
            if user.role=='admin' and not dto.reason:raise ArticleError('Admin phải ghi lý do ẩn bài','HIDE_REASON_REQUIRED',422)
            article.status='hidden';article.hidden_reason=dto.reason
            if user.role=='admin':article.blocked_by_admin=True
            update_metadata(article,user);db.flush();audit(db,user,'admin_hide' if user.role=='admin' else 'hide',article,{'reason':dto.reason})
        else:
            if not article.blocked_by_admin:raise ArticleError('Bài viết không có lệnh chặn của Admin','ARTICLE_NOT_BLOCKED')
            article.blocked_by_admin=False;update_metadata(article,user);db.flush();audit(db,user,'admin_release',article,{'reason':dto.reason})
        result=managed_article(article)
    return api_response(data=result)


@article_bp.route('/manage/<article_id>/history',methods=['GET'])
@jwt_required
@limiter.exempt
def article_history(article_id):
    with get_db() as db:
        actor(db,('manager','admin'))
        entries=db.query(ArticleAudit).filter_by(article_id=article_id).order_by(ArticleAudit.id.desc()).limit(100).all()
        return api_response(data=[{'id':e.id,'actor_id':e.actor_id,'action':e.action,'details':e.details,'created_at':e.created_at.isoformat()} for e in entries])


@article_bp.route('/positions/<position>',methods=['PATCH'])
@jwt_required
@limiter.exempt
def set_position(position):
    if position not in ROLES:raise ArticleError('Vị trí không hợp lệ','INVALID_POSITION',404)
    with get_db() as db:
        user=actor(db);dto=body(PositionEdit)
        item=db.query(RecruitmentPosition).filter_by(position=position).with_for_update().populate_existing().first()
        if item is None:raise ArticleError('Chưa có cấu hình vị trí','POSITION_NOT_FOUND',404)
        if item.version!=dto.expected_version:raise ArticleError('Vị trí đã thay đổi, vui lòng tải lại','POSITION_CHANGED')
        item.is_open=dto.is_open;item.version+=1;item.updated_by=user.id;item.updated_at=datetime.now(timezone.utc)
        audit(db,user,'position_open' if item.is_open else 'position_close',details={'position':position,'version':item.version})
        result={'position':item.position,'is_open':item.is_open,'version':item.version}
    return api_response(data=result)


@article_bp.route('/images',methods=['POST'])
@jwt_required
def upload_article_image():
    with get_db() as db:actor(db)
    image=request.files.get('file')
    if not image or not image.filename:raise ArticleError('Vui lòng chọn ảnh','INVALID_IMAGE',400)
    raw=image.read(5*1024*1024+1);image.seek(0)
    extension=Path(image.filename).suffix.lower()
    valid=(extension=='.png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (extension in ('.jpg','.jpeg') and raw.startswith(b'\xff\xd8\xff')) or (extension=='.gif' and raw[:6] in (b'GIF87a',b'GIF89a')) or (extension=='.webp' and raw[:4]==b'RIFF' and raw[8:12]==b'WEBP')
    if len(raw)>5*1024*1024 or not valid:raise ArticleError('Chỉ nhận ảnh PNG/JPG/GIF/WEBP hợp lệ, tối đa5MB','INVALID_IMAGE',422)
    filename=save_upload_file(image)
    if not filename:raise ArticleError('Không lưu được ảnh','INVALID_IMAGE',422)
    return api_response(data={'image_url':f'/uploads/{filename}'},status_code=201)
