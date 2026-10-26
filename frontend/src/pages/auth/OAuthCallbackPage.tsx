import { Link, useSearchParams } from 'react-router-dom';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const provider = params.get('provider');
  const providerName = provider ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)}` : 'Nhà cung cấp ngoài';

  let returnLocation = { pathname: '/', search: '', hash: '' };
  try {
    const target = new URL(params.get('next') || '/', window.location.origin);
    if (target.origin === window.location.origin) {
      returnLocation = {
        pathname: target.pathname,
        search: target.search,
        hash: target.hash,
      };
    }
  } catch {
    // Fall back to the home page when the return address is invalid.
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#f7f7fb]">
      <section className="w-full max-w-[480px] p-8 rounded-2xl bg-white shadow-xl flex flex-col items-center gap-5 text-center">
        <Link to="/" className="flex items-center gap-2" aria-label="Về trang chủ NEUFood">
          <img src="/neu-food.png" alt="" className="w-10 h-10 rounded-xl" />
          <span className="text-xl font-bold text-[#003f87]">NEUFood</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chưa thể hoàn tất đăng nhập</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600" role="status">
            {provider
              ? `Đăng nhập qua ${providerName} chưa được kết nối. Bạn có thể tiếp tục bằng email và mật khẩu.`
              : 'Đăng nhập từ nhà cung cấp ngoài chưa được kết nối. Bạn có thể tiếp tục bằng email và mật khẩu.'}
          </p>
        </div>
        <Link
          to="/dang-nhap"
          state={{ from: returnLocation }}
          className="w-full py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Đăng nhập bằng email
        </Link>
        <Link to="/" className="text-sm font-medium text-[#003f87] hover:underline">
          Về trang chủ
        </Link>
      </section>
    </main>
  );
}
