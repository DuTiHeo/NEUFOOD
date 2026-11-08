"""Chat-owned persistence."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from app.db.session import Base


class ChatOrderDraft(Base):
    __tablename__ = "chat_order_drafts"
    id = Column(String(32), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    revision = Column(Integer, nullable=False, default=1)
    payload = Column(JSON, nullable=False, default=dict)
    quote = Column(JSON, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=True)


class ChatDeliveryPreference(Base):
    __tablename__ = "chat_delivery_preferences"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    details = Column(JSON, nullable=False)
