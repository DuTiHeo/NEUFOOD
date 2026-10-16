import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './ChatbotWidget.module.css'

const API_BASE = import.meta.env.VITE_CHAT_API_URL ?? ''

// Parse markdown text to JSX
function parseMarkdown(text) {
  if (!text) return null
  
  // Split by lines first to handle line breaks
  const lines = text.split('\n')
  
  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <br key={`br-${lineIdx}`} />
    }
    
    // Parse bold text (**text**)
    const parts = []
    let lastIndex = 0
    const boldRegex = /\*\*(.+?)\*\*/g
    let match
    
    while ((match = boldRegex.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index))
      }
      // Add bold text
      parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>)
      lastIndex = boldRegex.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex))
    }
    
    // If no parts, just return the line
    if (parts.length === 0) {
      return <div key={`line-${lineIdx}`}>{line}</div>
    }
    
    return <div key={`line-${lineIdx}`}>{parts}</div>
  })
}

const QUICK_PROMPTS = [
  'Gợi ý món cho bữa trưa',
  'Cách đặt hàng trên web?',
  'Mất bao lâu để giao?',
]

export default function ChatbotWidget() {
  const { pathname } = useLocation()
  const hasBottomDock = ['/', '/menu', '/gio-hang'].includes(pathname)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

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

  const postJson = useCallback(async (path, body) => {
    const url = `${API_BASE}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(data.error || data.reply || `Lỗi ${res.status}`)
      error.status = res.status
      throw error
    }
    return data
  }, [])

  const sendMessage = useCallback(async (overrideText) => {
    const text = (overrideText != null ? String(overrideText) : input).trim()
    if (!text || loading || cooldownSec > 0) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const data = await postJson('/api/chat', { message: text })
      const reply = data.reply ?? 'Không có phản hồi'
      setMessages((prev) => [...prev, { role: 'bot', text: reply }])
    } catch (e) {
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
          text:
            e.message ||
            'Không gửi được tin.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, postJson, cooldownSec])

  const resetChat = useCallback(async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ đoạn chat?')) return
    try {
      await postJson('/api/reset')
      setMessages([])
    } catch {
      setMessages([])
    }
  }, [postJson])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const onQuick = (q) => {
    setInput(q)
    sendMessage(q)
  }

  return (
    <div
      className={styles.root}
      style={{
        '--chat-bottom': hasBottomDock ? '5.75rem' : '1.25rem',
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
                <p className={styles.headSub}>Hỏi về menu, đặt món, giao hàng</p>
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
                  Chào bạn! Mình là trợ lý NEUFood — hỏi về menu, đặt món hoặc giao hàng
                  trong campus nhé.
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
                <p className={styles.bubbleText}>{parseMarkdown(m.text)}</p>
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
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={sendMessage}
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
