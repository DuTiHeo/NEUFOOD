export const APP_CONFIG = {
  APP_NAME: 'NEUFood',
  CAMPUS_NAME: 'Trường Đại học Kinh tế Quốc dân (NEU)',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  DEFAULT_PAGE_SIZE: 20,
};

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROUTES = {
  HOME: '/',
  MENU: '/menu',
  DISH_DETAIL: (id: string | number = ':id') => `/mon/${id}`,
  NEAR_NEU: '/gan-neu',
  CART: '/gio-hang',
  CHECKOUT: '/thanh-toan',
  ORDERS: '/lich-su-don',
  ORDER_TRACKING: (id: string = ':orderId') => `/don-hang/${id}`,
  ACCOUNT: '/tai-khoan',
  STORY: '/story',
  RECRUIT: '/recruit',
  
  // Auth
  LOGIN: '/dang-nhap',
  REGISTER: '/dang-ky',
  FORGOT_PASSWORD: '/quen-mat-khau',
  OAUTH_CALLBACK: '/oauth/callback',

  // Admin
  ADMIN_LOGIN: '/quan-ly/dang-nhap',
  ADMIN_ROOT: '/quan-ly',
  ADMIN_REPORTS: '/quan-ly',
  ADMIN_DISHES: '/quan-ly/mon',
  ADMIN_ADD_DISH: '/quan-ly/mon/them',
  ADMIN_EDIT_DISH: (id: string | number = ':id') => `/quan-ly/mon/sua/${id}`,
  ADMIN_ORDERS: '/quan-ly/don',
};
