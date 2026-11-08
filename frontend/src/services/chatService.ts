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

export interface ChatRecipient { recipient_name: string; recipient_phone: string }

export type ChatAction =
  | { type: 'ORDER_CONFIRMATION'; draft_id: string; revision: number; expires_at: string; summary: Record<string, unknown>; recipient?: ChatRecipient }
  | { type: 'ORDER_COLLECTING'; draft_id?: string; revision?: number; recipient?: ChatRecipient }
  | { type: 'ORDER_CANCELLED' }
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
let chatOwner = 'guest';
const storageKey = (key: string) => `${key}:${chatOwner}`;

export function pendingOrder(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const action = messages[i].action;
    if (!action) continue;
    if (action.type === 'ORDER_CONFIRMATION') return action;
    if (action.type === 'ORDER_COLLECTING') return action.draft_id && action.revision ? action : null;
    if (['ORDER_CREATED', 'ORDER_CANCELLED', 'ORDER_FAILED'].includes(action.type)) return null;
  }
  return null;
}

export function pendingConfirmation(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const action = messages[i].action;
    if (!action) continue;
    if (action.type === 'ORDER_CONFIRMATION') return action;
    if (['ORDER_CREATED', 'ORDER_COLLECTING', 'ORDER_CANCELLED', 'ORDER_FAILED'].includes(action.type)) return null;
  }
  return null;
}

function generateLocalSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export const chatService = {
  setOwner(userId?: number): void { chatOwner = userId == null ? 'guest' : String(userId); },
  invalidateOwnerSession(userId?: number): void {
    const suffix = userId == null ? 'guest' : String(userId);
    try {
      sessionStorage.removeItem(`${CHAT_SESSION_STORAGE_KEY}:${suffix}`);
      const key = `${CHAT_MESSAGES_STORAGE_KEY}:${suffix}`;
      const stored = JSON.parse(sessionStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) {
        sessionStorage.setItem(key, JSON.stringify(stored.map((item) =>
          item?.action?.type === 'ORDER_CONFIRMATION' ? { ...item, action: null } : item)));
      }
    } catch { /* Storage failure must not expose another account's session. */ }
  },
  getSessionId(): string {
    try {
      let sid = sessionStorage.getItem(storageKey(CHAT_SESSION_STORAGE_KEY));
      if (!sid) {
        sid = generateLocalSessionId();
        sessionStorage.setItem(storageKey(CHAT_SESSION_STORAGE_KEY), sid);
      }
      return sid;
    } catch {
      return generateLocalSessionId();
    }
  },

  setSessionId(sessionId: string): void {
    try {
      if (sessionId) {
        sessionStorage.setItem(storageKey(CHAT_SESSION_STORAGE_KEY), sessionId);
      }
    } catch {
      // Ignore storage quota errors
    }
  },

  loadStoredMessages(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(storageKey(CHAT_MESSAGES_STORAGE_KEY));
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
        storageKey(CHAT_MESSAGES_STORAGE_KEY),
        JSON.stringify(messages.slice(-20))
      );
    } catch {
      // Ignore storage quota errors
    }
  },

  clearStoredMessages(): void {
    try {
      sessionStorage.removeItem(storageKey(CHAT_MESSAGES_STORAGE_KEY));
    } catch {
      // Ignore storage errors
    }
  },

  async sendMessage(message: string, history: ChatMessage[], decision?: 'confirm' | 'cancel', recipientUpdate?: ChatRecipient): Promise<ChatReplyData> {
    const requestOwner = chatOwner;
    const pending = pendingOrder(history);
    const sessionId = this.getSessionId();
    try {
      const res = await api.post<ApiResponse<ChatReplyData>>(
        '/chat/message',
        {
          message,
          session_id: sessionId,
          history: history.slice(-10).map(({role, text}) => ({role, text: text.slice(0, 2000)})),
          draft_id: pending?.draft_id,
          revision: pending?.revision,
          decision,
          recipient_update: recipientUpdate,
        },
        { timeout: 20000 }
      );
      const data = res.data.data;
      if (data?.session_id && chatOwner === requestOwner) {
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

  async resetChat(): Promise<boolean> {
    const sessionId = this.getSessionId();
    this.clearStoredMessages();
    this.setSessionId(generateLocalSessionId());
    try {
      await api.post<ApiResponse<ChatResetData>>('/chat/reset', { session_id: sessionId }, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },
};
