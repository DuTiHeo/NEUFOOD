import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Mail, Phone, HelpCircle } from 'lucide-react'
import styles from './Footer.module.css'
import { NEU_CAMPUS_MAP_EMBED_URL } from '../../data/campusMap'

export default function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.container}>
        <div className={styles.left}>
          <div className={styles.brandInfo}>
            <div className={styles.brandLogo}>
              <img src="/neu-food.png" alt="NEUFood" className={styles.footerLogoImg} />
              <span className={styles.brandTitle}>NEUFood</span>
            </div>
            <p className={styles.brandSlogan}>
              Nền tảng giao đồ ăn học đường hàng đầu dành riêng cho giảng viên và sinh viên Đại học Kinh tế Quốc dân.
            </p>
          </div>
          <iframe
            src={NEU_CAMPUS_MAP_EMBED_URL}
            className={styles.map}
            loading="lazy"
            allowFullScreen
            title="NEU Campus Map"
          ></iframe>
        </div>

        <div className={styles.right}>
          <h3 className={styles.sectionHeading}>Thông tin liên hệ</h3>

          <div className={styles.item}>
            <span className={styles.iconWrap}>
              <MapPin size={18} />
            </span>
            <div>
              <span className={styles.label}>Địa chỉ:</span>
              <a
                href="https://www.google.com/maps?q=207 Giải Phóng, Hà Nội"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                207 Giải Phóng, Phường Bạch Mai, Hai Bà Trưng, Hà Nội
              </a>
            </div>
          </div>

          <div className={styles.item}>
            <span className={styles.iconWrap}>
              <Mail size={18} />
            </span>
            <div>
              <span className={styles.label}>Email hỗ trợ:</span>
              <a href="mailto:NeuFood@neu.edu.vn" className={styles.link}>
                NeuFood@neu.edu.vn
              </a>
            </div>
          </div>

          <div className={styles.item}>
            <span className={styles.iconWrap}>
              <Phone size={18} />
            </span>
            <div>
              <span className={styles.label}>Hotline đặt món:</span>
              <a href="tel:0812852613" className={styles.link}>
                0812 852 613
              </a>
            </div>
          </div>

          <div className={styles.item}>
            <span className={styles.iconWrap}>
              <HelpCircle size={18} />
            </span>
            <div>
              <span className={styles.label}>Giải đáp thắc mắc:</span>
              <a href="mailto:ask-cait@neu.edu.vn" className={styles.link}>
                ask-cait@neu.edu.vn
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span className={styles.copy}>
            © 2026 NEUFood • Đồng hành cùng sinh viên Đại học Kinh tế Quốc dân
          </span>

          <div className={styles.footerLinks}>
            <Link to="/story" className={styles.footerLink}>
              Câu chuyện của chúng tôi
            </Link>
            <span className={styles.dot}>•</span>
            <Link to="/recruit" className={styles.footerLink}>
              Tuyển dụng nhân sự
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
