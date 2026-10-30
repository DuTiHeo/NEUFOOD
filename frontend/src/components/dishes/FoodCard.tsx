import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Check, Star } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import styles from './FoodCard.module.css'
import { Dish } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'

function formatPrice(vnd: number) {
  return `${(vnd || 0).toLocaleString('vi-VN')}đ`
}

interface FoodCardProps {
  dish: Dish | any
}

export default function FoodCard({ dish }: FoodCardProps) {
  const { add, getQty, maxDishQuantity } = useCart()
  const [added, setAdded] = useState(false)

  const imgSrc = getDishImageUrl(dish)
  const shortDesc = dish.shortDescription || dish.short_description
  const isBestSeller = dish.badges?.includes('bestSeller')
  const isHot = dish.badges?.includes('hot')
  const reviewCount = Number(dish.reviewCount ?? dish.review_count ?? 0)
  const reachedLimit = getQty(dish.id) >= maxDishQuantity

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!add(dish.id, 1)) return
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
    }, 1200)
  }

  return (
    <article className={styles.dish}>
      <div className={styles.dishMedia}>
        <Link className={styles.dishImgWrap} to={`/mon/${dish.id}`} aria-label={`Xem chi tiết ${dish.name}`}>
          <img className={styles.dishImg} src={imgSrc} alt={dish.name} loading="lazy" onError={handleDishImageError} />
        </Link>
        <div className={styles.dishBadges}>
          {isBestSeller && (
            <span className={styles.badgeBestSeller}>Bán chạy</span>
          )}
          {isHot && !isBestSeller && (
            <span className={styles.badgeHot}>Hot 🔥</span>
          )}
          {reviewCount > 0 && dish.rating && (
            <span className={styles.dishBadge}>
              <Star size={12} fill="currentColor" strokeWidth={0} />
              {dish.rating}
            </span>
          )}
        </div>
      </div>
      <div className={styles.dishBody}>
        <Link to={`/mon/${dish.id}`} className={styles.dishTitleLink}>
          <h3 className={styles.dishName}>{dish.name}</h3>
        </Link>
        {shortDesc && <p className={styles.dishDesc}>{shortDesc}</p>}
        <div className={styles.dishRow}>
          <span className={styles.dishPrice}>{formatPrice(dish.price)}</span>
          <button
            type="button"
            className={`${styles.dishAddBtn} ${added ? styles.dishAdded : ''}`}
            onClick={handleAddToCart}
            disabled={dish.is_available === false || reachedLimit}
            aria-label={`Thêm ${dish.name} vào giỏ hàng`}
            title={dish.is_available === false ? 'Món hiện đã hết' : reachedLimit ? `Đã đạt tối đa ${maxDishQuantity} phần` : 'Thêm vào giỏ hàng'}
          >
            {dish.is_available === false ? (
              <span aria-hidden>—</span>
            ) : added ? (
              <Check size={18} strokeWidth={2.5} />
            ) : (
              <Plus size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
