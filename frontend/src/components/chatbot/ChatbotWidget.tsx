import { useDishes } from '../../contexts/DishesContext'
import { addCartLine } from '../../utils/cartLines'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../hooks/useAuth'
import { chatService, ChatMessage, ChatRecipient, pendingConfirmation, pendingOrder } from '../../services/chatService'
import styles from './ChatbotWidget.module.css'
import { formatChatLine } from '../../utils/chatFormatting'

// Render the small Markdown subset used by chat without interpreting HTML.
function parseMarkdown(text: string): React.ReactNode {
  if (!text) return null

  const lines = text.split('\n')

  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <br key={`br-${lineIdx}`} />
    }

    const formatted = formatChatLine(line)
    return (
      <div key={`line-${lineIdx}`}>
        {formatted.list && '• '}
        {formatted.parts.map((part, index) => part.bold
          ? <strong key={index}>{part.text}</strong>
          : <React.Fragment key={index}>{part.text}</React.Fragment>)}
      </div>
    )
  })
}

const QUICK_PROMPTS: string[] = [
  'Gợi ý món ngon cho bữa trưa',
  'Đơn hàng của mình đến đâu rồi?',
  'Phí ship và cách đặt hàng?',
  'Canteen giao tới những tòa nào?',
]

export default function ChatbotWidget() {
  const { user } = useAuth()
  return <ChatbotSession key={user?.id ?? 'guest'} userId={user?.id} />
}

function ChatbotSession({ userId }: { userId?: number }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const cart = useCart()
  const { dishes, maxDishQuantity, error: menuError, isLoading: menuLoading } = useDishes()
  chatService.setOwner(userId)
  const owner = userId ?? null
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  const inFlight = useRef(false)
  const skipSave = useRef(false)
  const hasBottomDock = ['/', '/khach-hang', '/menu', '/gio-hang', '/tai-khoan', '/lich-su-don'].includes(pathname)
  // Hide chatbot on checkout page to avoid obscuring form inputs and the submit order button
  const isCheckout = pathname === '/thanh-toan'
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatService.loadStoredMessages())
  const [loading, setLoading] = useState(false)
  const [editingRecipient, setEditingRecipient] = useState(false)
  const [recipient, setRecipient] = useState<ChatRecipient>({ recipient_name: '', recipient_phone: '' })
  const [cooldownSec, setCooldownSec] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    chatService.setOwner(userId)
    ownerRef.current = owner
    skipSave.current = true
    setMessages(chatService.loadStoredMessages())
    setInput('')
    setLoading(false)
    inFlight.current = false
    return () => {
      ownerRef.current = null
      chatService.invalidateOwnerSession(userId)
    }
  }, [userId])

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return }
    chatService.saveStoredMessages(messages)
  }, [messages])

  const pending = pendingConfirmation(messages)
  const draft = pendingOrder(messages)

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
    async (overrideText?: string, decision?: 'confirm' | 'cancel', recipientUpdate?: ChatRecipient) => {
      const text = (typeof overrideText === 'string' ? overrideText : input).trim()
      if (!text || inFlight.current || loading || cooldownSec > 0) return
      inFlight.current = true
      const requestOwner = owner
      setInput('')

      const historySnapshot = messages
      const userTurn: ChatMessage = { role: 'user', text }
      setMessages((prev) => [...prev, userTurn])
      setLoading(true)

      try {
        const data = await chatService.sendMessage(text, historySnapshot, decision, recipientUpdate)
        if (ownerRef.current !== requestOwner) return
        const reply = data?.reply || 'Không có phản hồi từ trợ lý.'
        setEditingRecipient(false)

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
        if (ownerRef.current !== requestOwner) return
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
        if (ownerRef.current === requestOwner) {
          setLoading(false)
          inFlight.current = false
        }
      }
    },
    [input, loading, cooldownSec, messages, owner]
  )

  const resetChat = useCallback(async () => {
    if (inFlight.current) return
    const requestOwner = owner
    inFlight.current = true
    setMessages([])
    setEditingRecipient(false)
    setInput('')
    setCooldownSec(0)
    setLoading(true)
    try {
      const synced = await chatService.resetChat()
      if (!synced && ownerRef.current === requestOwner) {
        setMessages([{ role: 'bot', text: 'Đã xóa lịch sử trên thiết bị. Chưa đồng bộ được với máy chủ; cuộc trò chuyện mới dùng phiên mới.' }])
      }
    } finally {
      if (ownerRef.current === requestOwner) {
        inFlight.current = false
        setLoading(false)
      }
    }
  }, [owner])

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
                disabled={loading}
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

                {m.action?.type === 'ORDER_CHECKOUT_REQUIRED' && draft?.draft_id === m.action.draft_id && draft?.revision === m.action.revision && <button type="button" className={styles.actionBtn} disabled={loading || menuLoading || Boolean(menuError) || Date.parse(m.action.expires_at) <= Date.now()} onClick={()=>{
                  if (m.action?.type !== 'ORDER_CHECKOUT_REQUIRED') return
                  const summary=m.action.summary
                  if (cart.totalCount > 0 && !window.confirm('Thay giỏ hiện tại bằng nội dung đơn đang tư vấn để tiếp tục đặt cọc?')) return
                  try {
                    let rows:any[]=[]
                    for(const item of summary.items || []) {
                      const dish=dishes.find(d=>d.id===item.dish_id)
                      if (!dish) throw new Error('Món không còn trong thực đơn')
                      rows=addCartLine(rows,dish,item.quantity,maxDishQuantity,{note:item.note || ''})
                    }
                    if (!rows.length) return
                    localStorage.setItem('neufood-cart-v2',JSON.stringify(rows))
                    sessionStorage.setItem('neufood-checkout-from-chat',JSON.stringify({owner:userId,summary}))
                    window.location.assign('/thanh-toan')
                  } catch { setInput('Vui lòng kiểm tra lại món và số lượng trước khi chuyển sang thanh toán.') }
                }}>Chuyển sang thanh toán và đặt cọc mô phỏng</button>}

                {m.action?.type === 'ORDER_CONFIRMATION' && pending?.draft_id === m.action.draft_id && pending?.revision === m.action.revision && (
                  <div className={styles.actionCard} role="group" aria-label="Xác nhận đơn hàng">
                    <button type="button" className={styles.actionBtn} disabled={loading || cooldownSec > 0 || Date.parse(m.action.expires_at) <= Date.now()} onClick={() => sendMessage('Đồng ý đặt đơn', 'confirm')}>Xác nhận đặt đơn</button>
                    <button type="button" className={styles.actionBtn} disabled={loading} onClick={() => { setInput('Tôi muốn sửa món hoặc địa chỉ '); inputRef.current?.focus() }}>Sửa món / địa chỉ</button>
                    <button type="button" className={styles.actionBtn} disabled={loading} onClick={() => sendMessage('Bỏ đơn nháp', 'cancel')}>Bỏ đơn nháp</button>
                    <p className={styles.hint}>Đơn chỉ được tạo sau khi bạn xác nhận. Bạn có thể nhắn “đồng ý đặt đơn”.</p>
                  </div>
                )}

                {(m.action?.type === 'ORDER_CONFIRMATION' || m.action?.type === 'ORDER_COLLECTING' || m.action?.type === 'ORDER_CHECKOUT_REQUIRED') && m.action.draft_id && draft?.draft_id === m.action.draft_id && draft?.revision === m.action.revision && (
                  <button type="button" className={styles.actionBtn} disabled={loading} onClick={() => {
                    setRecipient(m.action && 'recipient' in m.action && m.action.recipient ? m.action.recipient : { recipient_name: '', recipient_phone: '' })
                    setEditingRecipient(true)
                  }}>Sửa thông tin đặt hàng</button>
                )}

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
                      <strong>Tổng thanh toán:</strong> {Number(m.action.order.total_amount).toLocaleString('vi-VN')}đ ({m.action.order.payment_method === 'cod_cash' ? 'Tiền mặt khi nhận' : 'VietQR khi nhận'})
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

          {editingRecipient && draft && (
            <form className={styles.actionCard} onSubmit={(event) => {
              event.preventDefault()
              sendMessage('Cập nhật người nhận cho đơn này', undefined, recipient)
            }}>
              <p>Thông tin sửa chỉ dùng cho đơn này, không thay hồ sơ hoặc thông tin mặc định.</p>
              <label>Họ tên người nhận
                <input aria-label="Họ tên người nhận" className={styles.input} required minLength={2} maxLength={150} value={recipient.recipient_name} onChange={e => setRecipient({ ...recipient, recipient_name: e.target.value })} disabled={loading} />
              </label>
              <label>Số điện thoại người nhận
                <input aria-label="Số điện thoại người nhận" className={styles.input} type="tel" required pattern="0[35789][0-9]{8}" value={recipient.recipient_phone} onChange={e => setRecipient({ ...recipient, recipient_phone: e.target.value })} disabled={loading} />
              </label>
              <button type="submit" className={styles.actionBtn} disabled={loading}>Lưu người nhận cho đơn này</button>
              <button type="button" className={styles.actionBtn} disabled={loading} onClick={() => setEditingRecipient(false)}>Đóng chỉnh sửa</button>
            </form>
          )}
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
