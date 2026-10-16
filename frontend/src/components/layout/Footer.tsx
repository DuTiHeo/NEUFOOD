import React from 'react'
import { Link } from 'react-router-dom'
import styles from './Footer.module.css'
import { NEU_CAMPUS_MAP_EMBED_URL } from '../../data/campusMap'

export default function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.container}>
        <div className={styles.left}>
          <iframe
            src={NEU_CAMPUS_MAP_EMBED_URL}
            className={styles.map}
            loading="lazy"
            allowFullScreen
            title="NEU Campus Map"
          ></iframe>
        </div>

        <div className={styles.right}>
          <div className={styles.item}>
            <span className={styles.icon}>📍</span>
            <span className={styles.label}>Địa Chỉ:</span>
            <a
              href="https://www.google.com/maps?q=207 Giải Phóng, Hà Nội"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              207 Giải Phóng, Phường Bạch Mai, Hà Nội
            </a>
          </div>

          <div className={styles.item}>
            <span className={styles.icon}>✉️</span>
            <span className={styles.label}>Email:</span>
            <a href="mailto:NeuFood@neu.edu.vn" className={styles.link}>
              NeuFood@neu.edu.vn
            </a>
          </div>

          <div className={styles.item}>
            <span className={styles.icon}>📞</span>
            <span className={styles.label}>Hotline:</span>
            <a href="tel:0812852613" className={styles.link}>
              0812852613
            </a>
          </div>

          <div className={styles.item}>
            <span className={styles.icon}>📨</span>
            <span className={styles.label}>Mọi Thắc Mắc Xin Liên Hệ:</span>
            <a href="mailto:ask-cait@neu.edu.vn" className={styles.link}>
              ask-cait@neu.edu.vn
            </a>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <span className={styles.copy}>
          © 2026 NEUFood
        </span>

        <div className={styles.footerLinks}>
          <Link to="/story" className={styles.footerLink}>
            Câu chuyện của chúng tôi
          </Link>
          <Link to="/recruit" className={styles.footerLink}>
            NEUFood đang tuyển nhân sự
          </Link>
        </div>
      </div>
    </footer>
  )
}
