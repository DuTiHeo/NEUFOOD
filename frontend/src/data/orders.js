/** Dữ liệu demo đơn hàng — có thể thay bằng API sau */
export const demoTracking = {
  id: 'NF12345',
  mapSrc:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAUuwhF8GNdgGR95qOJi11iKxjLCxjDGUlKhouJLoQnxUl86xsXm1s8deEQDCVWH6MqOK5nqzzsKs3uW1eFXnOscSIvIu0mNxU-PORZ0wQXn7ozgM7RMPYp-Zuw1Gje_9VAIcdLU6CsI-c7NbspbI9TsckCjyV5Hd1xUYUNn7JEOw-4SAl1w-QiPsHBFbCyxvgIHaVRHaWxbZJLn4kq_dce9hiSf0q-9hUF0ipLFaA188dgkXVXLTQ59bhp3WawwT2i0EEilGV0EVU',
  driver: {
    name: 'Nguyễn Văn A',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCwy4V-HN6BjEeMikhu1yOMgnC8GTUHtarhkAjJE-oiSA1RsZH01m8ropGHSMGuA-EMfP7Rj6QHtQC6bYhQiCHVICC1VzT9W3AEmew6gkzPKcl-C-frqoxFgfA7HliOktgvbODVzZt1z2hS5vzH_7LCvCZRzPGNo4BJV14_4gY76BlREpHK2JNVY5WEp77XkasXhrPlP58G5SEnb62fpSqyzYXl7U9ibQaYI-6AM6KhbUvKXJZ9sVcbYPsaqk566jPNtVpO19fyzqA',
  },
  items: [
    {
      name: 'Cơm Gà Xối Mỡ',
      note: 'Extra mỡ hành',
      qty: 1,
      price: 45000,
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAuUajAh5kGPqEjmbjGpLfpO4q6rXXpfhC_5in50xJi5EovQBZeLP0xvxJjmuvlMbcHFiq9EJucHKhw6D9Jb8Wo2TY4g8aIVwf849W2uGBIg3QaVES6cUgeXMwBcVUzIhkGsqutAPSD9NceZx-EV_7PlDFexQC5REP-1-I294Hr5MkPknCnv4NYnWuIcMZuj9WF4KiJ5paVqnR647hSEKDvyHa9sQgSagCNGK7PqAKOok5pVQuQTpYUvmMqgtrzsZ7vhadfOEMo6bs',
    },
    {
      name: 'Trà Sữa Trân Châu',
      note: '50% đá, 70% đường',
      qty: 1,
      price: 35000,
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAIWzJ_Ba0WJpoHg1KAgyeZmrANZK8iiu0nFC7uWPRU45CvBNpFv6Xg3w4P8Ix8THOFrPUtjDP89zyNQUT2mGgVEMeW2V75rLmAh141lZNJTKz4GvqJgc79HL12hC8zhjT5bIBW-FIBbeQusQQeuxklKeDsHL1Zas1WKdsa7tLIvpcRIO-X59VW7kzzGvoZFMzrX_P8w76Z0jdHBMUmcVXTTyvC7K3P7GTsJq2sR2W9mBTIhRXTkXCIJqsHjCkJNzFw5VFzf5My88w',
    },
  ],
  shipFee: 15000,
  address: {
    line1: 'Phòng A101, Tòa nhà A1',
    line2: 'Đại học Kinh tế Quốc dân',
  },
  eta: '12:30 - 12:45',
}

export const demoHistory = [
  {
    id: 'NF12345',
    status: 'delivered',
    date: '20/10/2024',
    time: '12:30',
    total: 85000,
    summary: 'Cơm Gà Xối Mỡ, Trà Sữa Thái Xanh',
    detail: '2 món • Giao tới Tòa A2, khu sinh viên',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDupdFhiqCLdwWjIAlI4VhJFDd6DypRg1_Rg6slKCZns6LqlK2QzeGgbCRQexs92xgCgqz3r-jNm1TQfYVeuY6ssW6PJWkzG4uW1ZuvMizVz0A_L-j4_eeMsF5pBR9L7nzlH94P-voT6a9JD15RmxZbYHe9xFkSKA3aYvhrgeW01van5coZbsSo7RQr3reuPrCwXh2rpR98NhUf9xG3V2pcNAGWZpHWjqFNkR-xyydl806bZIMHd8yNRm1Yvs_IEL6Od44GpRiMjH0',
  },
  {
    id: 'NF12301',
    status: 'cancelled',
    date: '18/10/2024',
    time: '18:15',
    total: 42000,
    summary: 'Burger Bò Phô Mai',
    detail: '1 món • Hoàn tiền về phương thức thanh toán',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA1HKe0NPNk0FjSRkAYKw59_XpY-tqmkMGuHBomYEl9Mj0e0qe3jrc3kNGAylbpIs4T93bGl5JfMytAt9_vEIvu725uZYRcPXliIhOnPydQLeG399jLkmYQdQ1gi74i8brsgazSV1Dyjt20z-75qoxNdgnQqRVRbZAh5GHDUaO2OyqVUFu36mtPTyAMyZkj9rLDBF6NoX3zLDpUSN7evkJ92ZUuJz8fsJx082ZjrloI9CP5NzFMhWVzZP4yujS8kHISxS5t8x0jHEo',
    dimmed: true,
  },
  {
    id: 'NF12288',
    status: 'delivered',
    date: '15/10/2024',
    time: '11:45',
    total: 125000,
    summary: 'Salad Ức Gà, Nước Ép Cam Tươi',
    detail: '3 món • Giao tới thư viện cánh B',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAAPSwNl9OMveWPz60nFPWGuyKVfr_H81MjkCuhJg37FW1YBAcR0eVRShVM5KvU9jHUU2e5gJSUHm_Z32ofjRJ_XsDcd84838Sut2kZ3zdSfJicvHP95wfjgZ4OZX53w19t_E1NufBxpnbiZoyRrCxZSG_YCF13W_hgSVGf_G2tdzUlTnwyIxB-FhpAew2PztMAfBnYS0FMxHixZYZK2uReS01vz5iEk7vJwT8Ni3lQ5w4aqp6X2V_bkXpnEk1r-jHSrtKxOhb5Sz0',
  },
]
