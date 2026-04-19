import { signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, LogOut, ShieldCheck, User as UserIcon, Clock } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export default function Auth() {
  const { user, profile, loading } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 text-center space-y-8">
          <div className="w-20 h-20 bg-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-red-200 rotate-3">
            <ShieldCheck className="w-12 h-12 text-white -rotate-3" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Đảng ủy Tây Nam</h1>
            <p className="text-slate-500 font-medium text-sm">Cổng kết nối ứng dụng & Nghiệp vụ nội bộ</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-3 rounded-2xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Đăng nhập với Google
          </button>
          <p className="text-xs text-slate-400">
            Sử dụng tài khoản Google đơn vị để truy cập hệ thống.
          </p>
        </div>
      </div>
    );
  }

  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">Chờ phê duyệt</h2>
            <p className="text-slate-500">
              Tài khoản của bạn đang chờ Quản trị viên kích hoạt và phân quyền. Vui lòng liên hệ bộ phận kỹ thuật.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  return null;
}
