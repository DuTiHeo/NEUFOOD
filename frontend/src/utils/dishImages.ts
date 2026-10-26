import type { SyntheticEvent } from 'react'

export const DISH_IMAGE_FALLBACK = '/dish-placeholder.svg'

type DishImageSource = {
  id?: string
  image?: string | null
  image_url?: string | null
}

type SeedImageCorrection = { from: string; to: string }

// Correct only the known seed URLs. If a manager changes a dish image in the API,
// the new URL is used as-is and remains editable from the management screen.
const seedImageCorrections: Record<string, SeedImageCorrection> = {
  'pho-bo-tai-lan': {
    from: 'https://live2makan.com/wp-content/uploads/2022/08/l2m-vn-2207-pho10-05.jpg',
    to: 'https://crm.vespaadventures.com/uploads/images/image-20260325125052-2.png',
  },
  'pho-tron-chua-ngot': {
    from: 'https://cdn.tgdd.vn/2021/08/CookRecipe/Avatar/pho-ga-tron-sa-te-thumbnail.jpg',
    to: 'https://cdn.tgdd.vn/2021/06/content/photron1-800x450.jpg',
  },
  'bun-rieu-cua-dong': {
    from: 'https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg',
    to: 'https://cdn.tgdd.vn/Files/2018/06/12/1094963/bon-buoc-de-co-ngay-mon-bun-rieu-cua-dong.jpg',
  },
  'com-ga-xoi-mo': {
    from: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuUajAh5kGPqEjmbjGpLfpO4q6rXXpfhC_5in50xJi5EovQBZeLP0xvxJjmuvlMbcHFiq9EJucHKhw6D9Jb8Wo2TY4g8aIVwf849W2uGBIg3QaVES6cUgeXMwBcVUzIhkGsqutAPSD9NceZx-EV_7PlDFexQC5REP-1-I294Hr5MkPknCnv4NYnWuIcMZuj9WF4KiJ5paVqnR647hSEKDvyHa9sQgSagCNGK7PqAKOok5pVQuQTpYUvmMqgtrzsZ7vhadfOEMo6bs',
    to: 'https://static.vinwonders.com/production/2025/02/com-ga-xoi-mo-ngon-nhat-sai-gon.jpg',
  },
  'com-suon-nuong': {
    from: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuUajAh5kGPqEjmbjGpLfpO4q6rXXpfhC_5in50xJi5EovQBZeLP0xvxJjmuvlMbcHFiq9EJucHKhw6D9Jb8Wo2TY4g8aIVwf849W2uGBIg3QaVES6cUgeXMwBcVUzIhkGsqutAPSD9NceZx-EV_7PlDFexQC5REP-1-I294Hr5MkPknCnv4NYnWuIcMZuj9WF4KiJ5paVqnR647hSEKDvyHa9sQgSagCNGK7PqAKOok5pVQuQTpYUvmMqgtrzsZ7vhadfOEMo6bs',
    to: 'https://www.dhfoods.com.vn/upload/Food-Recipe/Com-Tam-Sai-Gon/Com-Tam-Suon-Sai-Gon.png',
  },
  'tra-sua-tran-chau': {
    from: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIWzJ_Ba0WJpoHg1KAgyeZmrANZK8iiu0nFC7uWPRU45CvBNpFv6Xg3w4P8Ix8THOFrPUtjDP89zyNQUT2mGgVEMeW2V75rLmAh141lZNJTKz4GvqJgc79HL12hC8zhjT5bIBW-FIBbeQusQQeuxklKeDsHL1Zas1WKdsa7tLIvpcRIO-X59VW7kzzGvoZFMzrX_P8w76Z0jdHBMUmcVXTTyvC7K3P7GTsJq2sR2W9mBTIhRXTkXCIJqsHjCkJNzFw5VFzf5My88w',
    to: 'https://cutimart.com/cdn/shop/files/ra_S_a_Tran_Chau_D_ng_Den_1.jpg?v=1726023857&width=480',
  },
  'tra-dao-cam-sa': {
    from: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
    to: 'https://cdn2.fptshop.com.vn/unsafe/Uploads/images/tin-tuc/187846/Originals/cach-bao-quan-dao-ngam-5.jpg',
  },
  'nem-chua-ran': {
    from: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=400&q=80',
    to: 'https://cdn.eva.vn/upload/3-2023/images/2023-07-21/cach-lam-nem-chua-ran-ngon-tai-nha-chuan-vi-ngoai-hang-7-1689927673-855-width650height420.jpg',
  },
  'combo-com-ga-tra-dao': {
    from: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    to: 'https://hd1.hotdeal.vn/images/uploads/2016/Thang%209/9/292368/292368-com-ga-da-gion-body%20%2812%29.jpg',
  },
}

export function getDishImageUrl(dish: DishImageSource | null | undefined) {
  if (!dish) return DISH_IMAGE_FALLBACK

  const source = dish.image || dish.image_url || ''
  const correction = dish.id ? seedImageCorrections[dish.id] : undefined
  if (correction && source === correction.from) return correction.to
  return source || DISH_IMAGE_FALLBACK
}

export function handleDishImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  if (image.dataset.fallbackApplied) return
  image.dataset.fallbackApplied = 'true'
  image.src = DISH_IMAGE_FALLBACK
}
