import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { chatService, ChatMessage } from '../../services/chatService'
import styles from './ChatbotWidget.module.css'

// Parse markdown text (**bold** and line breaks) to JSX
function parseMarkdown(text: string): React.ReactNode {
  if (!text) return null

  const lines = text.split('\n')

  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <br key={`br-${lineIdx}`} />
    }

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const boldRegex = /\*\*(.+?)\*\*/g
    let match: RegExpExecArray | null

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index))
      }
      parts.push(<strong key={`bold-${lineIdx}-${match.index}`}>{match[1]}</strong>)
      lastIndex = boldRegex.lastIndex
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex))
    }

    if (parts.length === 0) {
      return <div key={`line-${lineIdx}`}>{line}</div>
    }

    return <div key={`line-${lineIdx}`}>{parts}</div>
  })
}

const QUICK_PROMPTS: string[] = [
  'Gợi ý món ngon cho bữa trưa',
  'Đơn hàng của mình đến đâu rồi?',
  'Phí ship và cách đặt hàng?',
  'Canteen giao tới những tòa nào?',
]

export default function ChatbotWidget() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const cart = useCart()
  const hasBottomDock = ['/', '/khach-hang', '/menu', '/gio-hang', '/tai-khoan', '/lich-su-don'].includes(pathname)
  // Hide chatbot on checkout page to avoid obscuring form inputs and the submit order button
  const isCheckout = pathname === '/thanh-toan'
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatService.loadStoredMessages())
  const [loading, setLoading] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    chatService.saveStoredMessages(messages)
  }, [messages])

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open, loading])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (cooldownSec <= 0) return
    const timer = setInterval(() => {
      setCooldownSec((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSec])

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (typeof overrideText === 'string' ? overrideText : input).trim()
      if (!text || loading || cooldownSec > 0) return
      setInput('')

      const historySnapshot = messages
      const userTurn: ChatMessage = { role: 'user', text }
      setMessages((prev) => [...prev, userTurn])
      setLoading(true)

      try {
        const data = await chatService.sendMessage(text, historySnapshot)
        const reply = data?.reply || 'Không có phản hồi từ trợ lý.'

        if (data?.action?.type === 'ADD_TO_CART' && Array.isArray(data.action.items)) {
          data.action.items.forEach((item) => {
            cart?.add?.(item.id, item.qty || 1)
          })
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            text: reply,
            action: data?.action,
            suggested_dishes: data?.suggested_dishes,
          },
        ])
      } catch (e: any) {
        if (e?.status === 429) {
          const waitSeconds =
            Number(e?.message?.match(/sau khoảng (\d+) giây/i)?.[1]) ||
            Number(e?.message?.match(/retry in ([0-9.]+)s/i)?.[1]) ||
            10
          setCooldownSec(Math.max(Math.ceil(waitSeconds), 5))
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            text: e?.message || 'Không gửi được tin nhắn, vui lòng thử lại.',
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [input, loading, cooldownSec, messages]
  )

  const resetChat = useCallback(async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ đoạn chat?')) return
    await chatService.resetChat()
    setMessages([])
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const onQuick = (q: string) => {
    setInput('')
    sendMessage(q)
  }

  if (isCheckout) {
    return null
  }

  return (
    <div
      className={styles.root}
      style={{
        ['--chat-bottom' as any]: hasBottomDock
          ? 'calc(4.75rem + env(safe-area-inset-bottom, 0px))'
          : 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {open ? (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Trợ lý NEUFood"
        >
          <header className={styles.head}>
            <div className={styles.headTitle}>
              <span className={styles.headBadge}>AI</span>
              <div>
                <p className={styles.headName}>Trợ lý NEUFood</p>
                <p className={styles.headSub}>Hỏi về menu, đặt món, đơn hàng</p>
              </div>
            </div>
            <div className={styles.headActions}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={resetChat}
                title="Xóa lịch sử chat"
                aria-label="Xóa lịch sử chat"
              >
                <span className="material-symbols-outlined">delete_sweep</span>
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setOpen(false)}
                title="Đóng"
                aria-label="Đóng khung chat"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </header>

          <div className={styles.messages} ref={listRef}>
            {messages.length === 0 && !loading && (
              <>
                <p className={styles.hint}>
                  Chào bạn! Mình là trợ lý AI NEUFood — hỏi về thực đơn Canteen A2, gợi ý món, quy định giao hàng hoặc tra cứu đơn hàng nhé.
                </p>
                <div className={styles.quickRow} role="group" aria-label="Gợi ý nhanh">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={styles.quickBtn}
                      onClick={() => onQuick(q)}
                      disabled={loading}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user' ? styles.bubbleUser : styles.bubbleBot
                }
              >
                <span className={styles.bubbleLabel}>
                  {m.role === 'user' ? 'Bạn' : 'Trợ lý'}
                </span>
                <div className={styles.bubbleText}>{parseMarkdown(m.text)}</div>

                {m.action?.type === 'ORDER_CREATED' && m.action.order && (
                  <div className={`${styles.actionCard} ${styles.orderSuccessCard}`}>
                    <div className={styles.cardHead}>
                      <span className={styles.badgeSuccess}>✅ Đặt đơn thành công</span>
                      <span className={styles.suffixBadge}>
                        Mã nhận: <span className={styles.suffixNum}>{m.action.order.order_code_suffix}</span>
                      </span>
                    </div>
                    <div className={styles.cardRow}>
                      <strong>Mã đơn:</strong> {m.action.order.id}
                    </div>
                    <div className={styles.cardRow}>
                      <strong>Địa chỉ:</strong> {m.action.order.delivery_address}
                    </div>
                    <div className={styles.cardRow}>
                      <strong>Tổng thanh toán:</strong> {m.action.order.total_amount?.toLocaleString('vi-VN')}đ ({m.action.order.payment_method})
                    </div>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setOpen(false)
                        navigate('/don-hang')
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>local_shipping</span>
                      Theo dõi đơn hàng
                    </button>
                  </div>
                )}

                {m.action?.type === 'ADD_TO_CART' && m.action.items && (
                  <div className={styles.actionCard}>
                    <div className={styles.cardHead}>
                      <span className={styles.badgeSuccess}>🛒 Đã thêm vào giỏ hàng</span>
                    </div>
                    <div className={styles.cartList}>
                      {m.action.items.map((it) => (
                        <div key={it.id} className={styles.cartItemRow}>
                          <span>{it.name} (x{it.qty})</span>
                          <span>{(it.price * it.qty).toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setOpen(false)
                        navigate('/gio-hang')
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>shopping_cart</span>
                      Xem giỏ hàng
                    </button>
                  </div>
                )}

                {m.action?.type === 'NEED_LOGIN' && (
                  <div className={styles.actionCard}>
                    <div className={styles.cardRow}>
                      Vui lòng đăng nhập tài khoản sinh viên để hoàn tất đặt đơn:
                    </div>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setOpen(false)
                        navigate('/dang-nhap')
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>login</span>
                      Đăng nhập để đặt hàng
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className={styles.typing} aria-live="polite" aria-busy="true">
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            )}
          </div>

          <div className={styles.compose}>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="Nhập câu hỏi…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading || cooldownSec > 0}
              aria-label="Nội dung tin nhắn"
              autoComplete="off"
              maxLength={500}
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={loading || cooldownSec > 0 || !input.trim()}
              aria-label="Gửi"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
          {cooldownSec > 0 ? (
            <p className={styles.hint} aria-live="polite">
              Hệ thống đang quá tải, bạn có thể gửi lại sau khoảng {cooldownSec} giây.
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI NEUFood'}
      >
        <img
          className={styles.fabImg}
          src="/linhvat.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
        />
      </button>
    </div>
  )
}
