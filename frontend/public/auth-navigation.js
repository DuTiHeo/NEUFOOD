// Preserve the intended destination across both static authentication pages.
let authDestination = '/';
try {
  const target = new URL(new URLSearchParams(location.search).get('next') || '/', location.origin);
  if (target.origin === location.origin && !/^\/(?:DANGNHAP\.html|DANGKY\.html|dang-nhap|dang-ky)(?:\/|$)/i.test(target.pathname)) {
    authDestination = target.pathname + target.search + target.hash;
  }
} catch { /* Use the home page for invalid destinations. */ }
// Resolve after credentials are saved, so the API role determines the destination.
Object.defineProperty(window, 'authDestination', { get() {
  let role;
  try {
    role = JSON.parse(localStorage.getItem('neufood_user') || sessionStorage.getItem('neufood_user') || 'null')?.role;
  } catch { /* Invalid stored user falls back to the customer page. */ }
  const home = { admin: '/admin', manager: '/quan-ly', staff: '/nhan-vien' }[role];
  if (home) {
    const path = authDestination.split(/[?#]/)[0];
    return path === home || path.startsWith(`${home}/`) ? authDestination : home;
  }
  return /^\/(?:admin|quan-ly|nhan-vien|nhanvien)(?:\/|$)/.test(authDestination) ? '/' : authDestination;
} });
document.querySelectorAll('a[href="DANGNHAP.html"], a[href="DANGKY.html"]').forEach((link) => {
  link.href = `${link.getAttribute('href')}?next=${encodeURIComponent(authDestination)}`;
});
if (localStorage.getItem('neufood_token') || sessionStorage.getItem('neufood_token')) {
  location.replace(window.authDestination);
}
