from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ChatHistoryItem(BaseModel):
    """Một lượt tin nhắn trong lịch sử hội thoại giữa người dùng và Trợ lý AI."""
    role: Literal["user", "bot", "assistant", "model"]
    text: str = Field(..., min_length=1, max_length=2000)

    @field_validator("text", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class ChatMessageRequest(BaseModel):
    """DTO kiểm tra đầu vào cho API gửi tin nhắn tới Chatbot AI (/api/v1/chat/message)."""
    message: str = Field(..., min_length=1, max_length=500, description="Câu hỏi hoặc yêu cầu của người dùng")
    session_id: Optional[str] = Field(default=None, max_length=64, description="Định danh phiên hội thoại")
    history: Optional[List[ChatHistoryItem]] = Field(
        default=None,
        max_length=20,
        description="Lịch sử hội thoại gần nhất từ phía client (dùng làm fallback khi Redis cache miss)",
    )

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_session_id(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value


class ChatResetRequest(BaseModel):
    """DTO kiểm tra đầu vào cho API xóa lịch sử hội thoại (/api/v1/chat/reset)."""
    session_id: Optional[str] = Field(default=None, max_length=64, description="Định danh phiên hội thoại cần xóa")

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_session_id(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value
