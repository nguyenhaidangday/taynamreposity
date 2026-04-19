import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { User as UserIcon, Save, Mail, Shield, Camera } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

export default function Profile() {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!profile) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    
    setUpdating(true);
    setSuccess(false);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: displayName.trim()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600" />
        
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6">
            <div className="w-32 h-32 rounded-3xl border-4 border-white bg-slate-100 overflow-hidden shadow-lg">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="w-12 h-12 text-slate-400" />
                </div>
              )}
            </div>
            <button className="absolute bottom-2 right-2 p-2 bg-white rounded-xl shadow-md hover:bg-slate-50 transition-colors border border-slate-100">
              <Camera className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Thông tin cá nhân</h2>
              <p className="text-slate-500">Cập nhật thông tin hiển thị của bạn trên hệ thống</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Họ và tên</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Nhập họ và tên của bạn"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Tên này sẽ được dùng để khớp với các file Excel giao việc</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Vai trò hệ thống</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={profile.role}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                {success && (
                  <span className="text-sm text-green-600 font-medium animate-fade-in">
                    Đã cập nhật thông tin thành công!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={updating || !displayName.trim() || displayName === profile.displayName}
                  className="ml-auto flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
                >
                  <Save className="w-5 h-5" />
                  {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>

            <div className="pt-8 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Truy cập API & Tên miền</h3>
              <p className="text-slate-500 text-sm mb-4">Hệ thống hỗ trợ kết nối API để truy xuất dữ liệu từ các ứng dụng bên ngoài hoặc Excel.</p>
              
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">GET</span>
                    <code className="text-[10px] text-slate-400 font-mono italic break-all">
                      {window.location.origin}/api/indicators
                    </code>
                  </div>
                  <p className="text-xs text-slate-600">Lấy danh sách toàn bộ các chỉ tiêu phát triển.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">GET</span>
                    <code className="text-[10px] text-slate-400 font-mono italic break-all">
                      {window.location.origin}/api/tasks
                    </code>
                  </div>
                  <p className="text-xs text-slate-600">Lấy danh sách toàn bộ các công việc và nhiệm vụ.</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 space-y-2">
                <div className="font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Cấu hình Tên miền Tùy chỉnh (taynam.net)
                </div>
                <p>Để tính năng Đăng nhập hoạt động ổn định trên tên miền mới, bạn cần:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Truy cập <strong>Firebase Console</strong>.</li>
                  <li>Vào <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong>.</li>
                  <li>Thêm <strong>taynam.net</strong> vào danh sách được phép.</li>
                </ol>
              </div>
              
              <p className="mt-4 text-[10px] text-slate-400 italic">
                * Lưu ý: API hiện tại đang mở công khai. Nếu cần bảo mật bằng API Key, vui lòng yêu cầu quản trị viên cấu hình thêm.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
