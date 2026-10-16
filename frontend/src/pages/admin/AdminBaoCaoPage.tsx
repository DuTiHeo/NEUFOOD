import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { dishes } from '../../data/dishes.js'
import styles from './AdminBaoCaoPage.module.css'

Chart.register(...registerables)

// Tạo topItems từ dữ liệu dishes, sắp xếp theo reviewCount
const totalReviews = dishes.reduce((sum, dish) => sum + dish.reviewCount, 0)
const topItems = dishes
  .sort((a, b) => b.reviewCount - a.reviewCount)
  .slice(0, 4)
  .map(dish => ({
    name: dish.name,
    sold: dish.reviewCount,
    pct: Math.round((dish.reviewCount / totalReviews) * 100),
    img: dish.image
  }))

export default function AdminBaoCaoPage() {
  const [range, setRange] = useState('30')
  const lineRef = useRef(null)
  const pieRef = useRef(null)
  const lineChartRef = useRef(null)
  const pieChartRef = useRef(null)

  useEffect(() => {
    const lc = lineRef.current
    const pc = pieRef.current
    if (!lc || !pc) return

    lineChartRef.current?.destroy()
    pieChartRef.current?.destroy()

    lineChartRef.current = new Chart(lc, {
      type: 'line',
      data: {
        labels: ['1', '5', '10', '15', '20', '25', '30'],
        datasets: [
          {
            label: 'Doanh thu (k đ)',
            data: [450, 780, 600, 950, 820, 1100, 980],
            borderColor: '#003f87',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280)
              g.addColorStop(0, 'rgba(0, 63, 135, 0.15)')
              g.addColorStop(1, 'rgba(0, 63, 135, 0)')
              return g
            },
            pointRadius: 0,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { borderDash: [4, 4], drawBorder: false },
            ticks: { callback: (v) => `${v}k` },
          },
          x: { grid: { display: false } },
        },
      },
    })

    pieChartRef.current = new Chart(pc, {
      type: 'doughnut',
      data: {
        labels: ['Phở', 'Bún', 'Món trộn', 'Món khác'],
        datasets: [
          {
            data: [42, 28, 18, 12],
            backgroundColor: ['#003f87', '#4f46e5', '#fbbf24', '#f87171'],
            borderWidth: 0,
            cutout: '75%',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    })

    return () => {
      lineChartRef.current?.destroy()
      pieChartRef.current?.destroy()
    }
  }, [range])

  return (
    <>
      <header class={styles.hd}>
        <div>
          <h1 class={styles.h1}>Thống kê &amp; báo cáo</h1>
          <p class={styles.sub}>Theo dõi hiệu suất đặt món campus (dữ liệu demo).</p>
        </div>
        <div class={styles.range}>
          <button
            type="button"
            class={`${styles.rngBtn} ${range === '30' ? styles.rngOn : ''}`}
            onClick={() => setRange('30')}
          >
            30 ngày
          </button>
          <button
            type="button"
            class={`${styles.rngBtn} ${range === '90' ? styles.rngOn : ''}`}
            onClick={() => setRange('90')}
          >
            3 tháng
          </button>
          <button
            type="button"
            class={`${styles.rngBtn} ${range === 'custom' ? styles.rngOn : ''}`}
            onClick={() => setRange('custom')}
          >
            Tuỳ chọn
          </button>
        </div>
      </header>

      <section class={styles.metrics}>
        <div class={styles.mc}>
          <div class={styles.mcTop}>
            <span class={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#eff6ff', color: '#2563eb' }}>
              payments
            </span>
            <span class={`${styles.trend} ${styles.trendUp}`}>
              <span class="material-symbols-outlined" style={{ fontSize: '14px' }}>
                trending_up
              </span>
              +12,5%
            </span>
          </div>
          <p class={styles.mcLbl}>Tổng doanh thu</p>
          <p class={styles.mcVal}>25.400.000đ</p>
        </div>
        <div class={styles.mc}>
          <div class={styles.mcTop}>
            <span class={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#eef2ff', color: '#4f46e5' }}>
              receipt
            </span>
            <span class={`${styles.trend} ${styles.trendUp}`}>
              <span class="material-symbols-outlined" style={{ fontSize: '14px' }}>
                trending_up
              </span>
              +5,2%
            </span>
          </div>
          <p class={styles.mcLbl}>Tổng đơn</p>
          <p class={styles.mcVal}>1.248</p>
        </div>
        <div class={styles.mc}>
          <div class={styles.mcTop}>
            <span class={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#fffbeb', color: '#d97706' }}>
              avg_pace
            </span>
            <span class={`${styles.trend} ${styles.trendFlat}`}>Ổn định</span>
          </div>
          <p class={styles.mcLbl}>TB giá trị đơn</p>
          <p class={styles.mcVal}>45.000đ</p>
        </div>
        <div class={styles.mc}>
          <div class={styles.mcTop}>
            <span class={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#faf5ff', color: '#9333ea' }}>
              group
            </span>
            <span class={`${styles.trend} ${styles.trendUp}`}>
              <span class="material-symbols-outlined" style={{ fontSize: '14px' }}>
                trending_up
              </span>
              +8%
            </span>
          </div>
          <p class={styles.mcLbl}>Sinh viên hoạt động</p>
          <p class={styles.mcVal}>850</p>
        </div>
      </section>

      <section class={styles.charts}>
        <div class={styles.chartCard}>
          <div class={styles.chartHd}>
            <div>
              <h2 class={styles.chartTit}>Xu hướng doanh thu</h2>
              <p class={styles.chartSub}>Theo ngày trong kỳ đang chọn</p>
            </div>
            <div class={styles.legend}>
              <span class={styles.dot} />
              Tháng này
            </div>
          </div>
          <div class={styles.canvas}>
            <canvas ref={lineRef} />
          </div>
        </div>
        <div class={styles.chartCard}>
          <h2 class={styles.chartTit} style={{ marginBottom: '1.5rem' }}>
            Món bán chạy
          </h2>
          <div class={styles.topList}>
            {topItems.map((t) => (
              <div key={t.name} class={styles.topItem}>
                <div class={styles.topImg}>
                  <img src={t.img} alt="" />
                </div>
                <div class={styles.topBody}>
                  <div class={styles.topRow}>
                    <span class={styles.topName}>{t.name}</span>
                    <span class={styles.topSold}>{t.sold} đơn</span>
                  </div>
                  <div class={styles.barBg}>
                    <div class={styles.barFg} style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" class={styles.btnAll}>
            Xem toàn bộ thực đơn
          </button>
        </div>
      </section>

      <section class={styles.bottom}>
        <div class={styles.split}>
          <div class={styles.pieWrap}>
            <h2 class={styles.chartTit}>Tỷ trọng danh mục</h2>
            <p class={styles.chartSub} style={{ marginBottom: '1rem' }}>
              Phân bổ doanh thu theo nhóm món
            </p>
            <div class={styles.pieCanvas}>
              <canvas ref={pieRef} />
            </div>
          </div>
          <div class={styles.insights}>
            <div class={styles.insItem}>
              <p class={styles.insLbl}>Dẫn đầu</p>
              <p class={styles.insTxt}>Phở &amp; bún (42%)</p>
            </div>
            <div class={styles.insItem}>
              <p class={styles.insLbl}>Tăng nhanh</p>
              <p class={styles.insTxt}>Món trộn &amp; đặc sản (28%)</p>
            </div>
            <div class={styles.insItem}>
              <p class={styles.insLbl}>Món khác</p>
              <p class={styles.insTxt}>Ăn vặt &amp; đồ uống (18%)</p>
            </div>
          </div>
        </div>
        <div class={styles.feed}>
          <div class={styles.feedHd}>
            <h2 class={styles.feedTit}>Insight hoạt động</h2>
            <button type="button" class={styles.feedLink}>
              Live
            </button>
          </div>
          <div class={styles.events}>
            <div class={styles.ev}>
              <div class={styles.evIco}>
                <span class="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  schedule
                </span>
              </div>
              <div>
                <p class={styles.evTit}>Giờ cao điểm</p>
                <p class={styles.evTxt}>
                  Mật độ đơn cao nhất <strong style={{ color: 'var(--color-brand)' }}>11:30–13:15</strong> hôm nay.
                </p>
              </div>
            </div>
            <div class={styles.ev}>
              <div class={styles.evIco} style={{ background: '#fffbeb', color: '#d97706' }}>
                <span class="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  local_fire_department
                </span>
              </div>
              <div>
                <p class={styles.evTit}>Xu hướng “Healthy”</p>
                <p class={styles.evTxt}>
                  Nhóm salad tăng <strong style={{ color: '#d97706' }}>22%</strong> từ đầu tuần.
                </p>
              </div>
            </div>
            <div class={styles.ev}>
              <div class={styles.evIco} style={{ background: '#faf5ff', color: '#9333ea' }}>
                <span class="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  notifications_active
                </span>
              </div>
              <div>
                <p class={styles.evTit}>Cảnh báo tồn kho</p>
                <p class={styles.evTxt}>Trân chà trà sữa dưới 15% — nên nhập trước sáng mai.</p>
              </div>
            </div>
          </div>
          <div class={styles.tipBox}>
            <div class={styles.tipTxt}>
              <span class="material-symbols-outlined">lightbulb</span>
              Gợi ý: gói Cơm + Đồ uống để tăng giá trị đơn.
            </div>
            <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
              chevron_right
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
