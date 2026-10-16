import styles from './GanNeuPage.module.css'

export default function GanNeuPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCard}>
          <h1 className={styles.title}>Các quán ăn gần NEU</h1>
          <div className={styles.imageGrid}>
            <img
              src="/quananganneu.jpg"
              alt="Quán ăn gần NEU"
              className={styles.heroImage}
            />
            <img
              src="/quanannganneu2.jpg"
              alt="Quán ăn gần NEU"
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
