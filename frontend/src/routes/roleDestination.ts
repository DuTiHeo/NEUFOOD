export function roleDestination(role?: string) {
  if (role === 'admin') return '/admin'
  if (role === 'manager') return '/quan-ly'
  if (role === 'staff') return '/nhan-vien'
  return '/'
}
