from datetime import datetime,timezone
from sqlalchemy import text
from app.db.article_models import Article,ArticleAudit
from app.schemas.article import ArticleContent,ROLES


class ArticleError(Exception):
    def __init__(self,message,code,status=409):super().__init__(message);self.code=code;self.status=status


def audit(db,actor,action,article=None,details=None):
    db.add(ArticleAudit(article_id=article.id if article else None,actor_id=actor.id,action=action,details=details or {}))
    db.flush()


def public_article(article):
    return {'id':article.id,'kind':article.kind,'content':article.published,'published_at':article.published_at.isoformat() if article.published_at else None}


def managed_article(article):
    return public_article(article)|{'status':article.status,'draft':article.draft,'version':article.version,'blocked_by_admin':article.blocked_by_admin,'hidden_reason':article.hidden_reason,'created_by':article.created_by,'updated_by':article.updated_by,'created_at':article.created_at.isoformat(),'updated_at':article.updated_at.isoformat()}


def check_version(article,version):
    if article is None:raise ArticleError('Không tìm thấy bài viết','ARTICLE_NOT_FOUND',404)
    if article.version!=version:raise ArticleError('Bài viết đã thay đổi. Vui lòng tải lại trước khi lưu.','ARTICLE_CHANGED')


def lock_article(db,id,version,publishing=False):
    if publishing:
        existing=db.get(Article,id)
        if existing is None:raise ArticleError('Không tìm thấy bài viết','ARTICLE_NOT_FOUND',404)
        if existing.kind in ('recruitment','story'):
            db.execute(text('SELECT pg_advisory_xact_lock(:key)'),{'key':481201 if existing.kind=='recruitment' else 481202})
    article=db.query(Article).filter_by(id=id).with_for_update().populate_existing().first()
    check_version(article,version)
    return article


def update_metadata(article,actor):
    article.version+=1;article.updated_by=actor.id;article.updated_at=datetime.now(timezone.utc)


def publish(db,article,actor):
    if article.blocked_by_admin:raise ArticleError('Bài đang bị Admin chặn xuất bản. Liên hệ Admin để gỡ chặn.','ARTICLE_ADMIN_BLOCKED',403)
    content=ArticleContent.model_validate(article.draft).model_dump()
    def has_text(node):return bool(node.get('text','').strip()) or any(has_text(child) for child in node.get('content',[]))
    if not content['title'].strip() or not has_text(content['body']):raise ArticleError('Bổ sung tiêu đề và nội dung trước khi xuất bản.','ARTICLE_INCOMPLETE',422)
    if article.kind=='recruitment':
        blocks=content['recruitment_roles']
        if len(blocks)!=4 or {b['position'] for b in blocks}!=set(ROLES) or any(not b['description'] for b in blocks):
            raise ArticleError('Bài tuyển dụng phải có đủ mô tả bốn vị trí.','RECRUITMENT_BLOCKS_REQUIRED',422)
    if article.kind in ('recruitment','story'):
        for previous in db.query(Article).filter(Article.kind==article.kind,Article.status=='published',Article.id!=article.id).with_for_update().all():
            previous.status='hidden';update_metadata(previous,actor);audit(db,actor,'replaced',previous,{'replacement_id':article.id})
        db.flush()
    article.published=content;article.status='published';article.published_at=datetime.now(timezone.utc);article.hidden_reason=''
    update_metadata(article,actor);db.flush();audit(db,actor,'publish',article,{'content':content})
    return article
