import React from 'react'
import { Link } from 'react-router-dom'
import styles from './FoodCard.module.css'
import { Dish } from '../../types/dish'

function formatPrice(vnd: number) {
  return `${vnd.toLocaleString('vi-VN')}đ`
}

interface FoodCardProps {
  dish: Dish | any
}

export default function FoodCard({ dish }: FoodCardProps) {
  const imgSrc = dish.image || dish.image_url
  const shortDesc = dish.shortDescription || dish.short_description

  return (
    <article className={styles.dish}>
      <div className={styles.dishMedia}>
        <Link className={styles.dishImgWrap} to={`/mon/${dish.id}`}>
          <img className={styles.dishImg} src={imgSrc} alt={dish.name} />
        </Link>
        <div className={styles.dishBadge}>
          <span className={`material-symbols-outlined ${styles.dishStar}`}>star</span>
          {dish.rating}
        </div>
      </div>
      <div className={styles.dishBody}>
        <Link to={`/mon/${dish.id}`}>
          <h3 className={styles.dishName}>{dish.name}</h3>
        </Link>
        <p className={styles.dishDesc}>{shortDesc}</p>
        <div className={styles.dishRow}>
          <span className={styles.dishPrice}>{formatPrice(dish.price)}</span>
          <Link className={styles.dishAdd} to={`/mon/${dish.id}`} aria-label={`Xem ${dish.name}`}>
            <span className="material-symbols-outlined">add_shopping_cart</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
