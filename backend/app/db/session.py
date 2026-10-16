from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base
from app.core.config import settings

# Khởi tạo SQLAlchemy Engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=(settings.FLASK_ENV == "development")
)

# Khởi tạo Session Factory & Scoped Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_session = scoped_session(SessionLocal)

# Declarative Base cho ORM Models
Base = declarative_base()
Base.query = db_session.query_property()

@contextmanager
def get_db():
    """
    Context manager cung cấp Database Session an toàn cho từng request/transaction.
    Tự động rollback nếu xảy ra Exception và đóng kết nối sau khi hoàn tất.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
