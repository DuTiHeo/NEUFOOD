from datetime import datetime,timezone
from uuid import uuid4
from sqlalchemy import Column,String,Integer,Boolean,DateTime,ForeignKey,Text,Index,CheckConstraint,text
from sqlalchemy.dialects.postgresql import JSONB
from .session import Base


class Article(Base):
    __tablename__='articles'
    id=Column(String(32),primary_key=True,default=lambda:uuid4().hex)
    kind=Column(String(20),nullable=False)
    status=Column(String(20),nullable=False,default='draft')
    draft=Column(JSONB,nullable=False)
    published=Column(JSONB)
    version=Column(Integer,nullable=False,default=1)
    blocked_by_admin=Column(Boolean,nullable=False,default=False)
    hidden_reason=Column(Text,nullable=False,default='')
    created_by=Column(Integer,ForeignKey('users.id',ondelete='SET NULL'))
    updated_by=Column(Integer,ForeignKey('users.id',ondelete='SET NULL'))
    created_at=Column(DateTime(timezone=True),nullable=False,default=lambda:datetime.now(timezone.utc))
    updated_at=Column(DateTime(timezone=True),nullable=False,default=lambda:datetime.now(timezone.utc))
    published_at=Column(DateTime(timezone=True))
    __table_args__=(CheckConstraint("kind IN ('recruitment','story','announcement','news')",name='article_kind_check'),
       CheckConstraint("status IN ('draft','published','hidden')",name='article_status_check'),
       Index('article_one_featured_kind','kind',unique=True,postgresql_where=text("status='published' AND kind IN ('recruitment','story')")))


class ArticleAudit(Base):
    __tablename__='article_audit'
    id=Column(Integer,primary_key=True,autoincrement=True)
    article_id=Column(String(32),ForeignKey('articles.id'),nullable=True)
    actor_id=Column(Integer,ForeignKey('users.id',ondelete='SET NULL'))
    action=Column(String(40),nullable=False)
    details=Column(JSONB,nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,default=lambda:datetime.now(timezone.utc))


class RecruitmentPosition(Base):
    __tablename__='recruitment_positions'
    position=Column(String(30),primary_key=True)
    is_open=Column(Boolean,nullable=False,default=True)
    version=Column(Integer,nullable=False,default=1)
    updated_by=Column(Integer,ForeignKey('users.id',ondelete='SET NULL'))
    updated_at=Column(DateTime(timezone=True),nullable=False,default=lambda:datetime.now(timezone.utc))
