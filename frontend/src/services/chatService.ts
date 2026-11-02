import api from './api';
import { ApiResponse } from '../types/auth';

export interface SuggestedDish {
  id: string;
  name: string;
  price: number;
  rating: number;
  image_url: string;
  short_description: string;
}

export interface ChatOrderAction {
  id: string;
  order_code_suffix: string;
  status: string;
  status_label: string;
  order_type: string;
  delivery_address: string;
  total_amount: number;
  eta: string;
  payment_method: string;
}

export interface ChatCartItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  qty: number;
}

export type ChatAction =
  | { type: 'ORDER_CREATED'; order: ChatOrderAction }
  | { type: 'ORDER_FAILED'; error: string; code?: string }
  | { type: 'ADD_TO_CART'; items: ChatCartItem[] }
  | { type: 'NEED_LOGIN'; pending_order?: any };

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  action?: ChatAction | null;
  suggested_dishes?: SuggestedDish[];
}

export interface ChatReplyData {
  reply: string;
  session_id: string;
  provider: 'gemini' | 'fallback';
  suggested_dishes: SuggestedDish[];
  action?: ChatAction | null;
}

export interface ChatResetData {
  session_id: string;
  previous_session_id: string;
  cleared: boolean;
}

const CHAT_SESSION_STORAGE_KEY = 'neufood_chat_session_id';
const CHAT_MESSAGES_STORAGE_KEY = 'neufood_chat_messages';

function generateLocalSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export const chatService = {
  getSessionId(): string {
    try {
      let sid = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (!sid) {
        sid = generateLocalSessionId();
        sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, sid);
      }
      return sid;
    } catch {
      return generateLocalSessionId();
    }
  },

  setSessionId(sessionId: string): void {
    try {
      if (sessionId) {
        sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, sessionId);
      }
    } catch {
      // Ignore storage quota errors
    }
  },

  loadStoredMessages(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is ChatMessage =>
          item &&
          (item.role === 'user' || item.role === 'bot') &&
          typeof item.text === 'string' &&
          item.text.trim().length > 0
      );
    } catch {
      return [];
    }
  },

  saveStoredMessages(messages: ChatMessage[]): void {
    try {
      sessionStorage.setItem(
        CHAT_MESSAGES_STORAGE_KEY,
        JSON.stringify(messages.slice(-20))
      );
    } catch {
      // Ignore storage quota errors
    }
  },

  clearStoredMessages(): void {
    try {
      sessionStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  },

  async sendMessage(message: string, history: ChatMessage[]): Promise<ChatReplyData> {
    const sessionId = this.getSessionId();
    try {
      const res = await api.post<ApiResponse<ChatReplyData>>(
        '/chat/message',
        {
          message,
          session_id: sessionId,
          history: history.slice(-10),
        },
        { timeout: 20000 }
      );
      const data = res.data.data;
      if (data?.session_id) {
        this.setSessionId(data.session_id);
      }
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Không gửi được tin nhắn, vui lòng thử lại.';
      const wrappedError: Error & { status?: number } = new Error(serverMsg);
      wrappedError.status = status;
      throw wrappedError;
    }
  },

  async resetChat(): Promise<void> {
    const sessionId = this.getSessionId();
    this.clearStoredMessages();
    try {
      const res = await api.post<ApiResponse<ChatResetData>>('/chat/reset', {
        session_id: sessionId,
      });
      const newSessionId = res.data?.data?.session_id;
      this.setSessionId(newSessionId || generateLocalSessionId());
    } catch {
      this.setSessionId(generateLocalSessionId());
    }
  },
};
