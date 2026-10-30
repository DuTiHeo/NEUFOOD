// Preserve the intended destination across both static authentication pages.
let authDestination = '/';
try {
  const target = new URL(new URLSearchParams(location.search).get('next') || '/', location.origin);
  if (target.origin === location.origin && !/^\/(?:DANGNHAP\.html|DANGKY\.html|dang-nhap|dang-ky)(?:\/|$)/i.test(target.pathname)) {
    authDestination = target.pathname + target.search + target.hash;
  }
} catch { /* Use the home page for invalid destinations. */ }
window.authDestination = authDestination;
document.querySelectorAll('a[href="DANGNHAP.html"], a[href="DANGKY.html"]').forEach((link) => {
  link.href = `${link.getAttribute('href')}?next=${encodeURIComponent(authDestination)}`;
});
if (localStorage.getItem('neufood_token') || sessionStorage.getItem('neufood_token')) {
  location.replace(authDestination);
}
