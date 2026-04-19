import { useState, FormEvent } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useData } from '../hooks/useData';
import { ExternalApp } from '../types';
import { Plus, Trash2, Edit2, Layout, ExternalLink, MoveUp, MoveDown, Globe, Image as ImageIcon, Save, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AppManagement() {
  const { externalApps } = useData();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ExternalApp | null>(null);
  const [loading, setLoading] = useState(false);
  const [appToDelete, setAppToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    icon: 'Globe',
    url: '',
    description: '',
    position: 0,
    isInternal: false
  });

  const resetForm = () => {
    setFormData({
      name: '',
      icon: 'Globe',
      url: '',
      description: '',
      position: externalApps.length,
      isInternal: false
    });
    setEditingApp(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingApp) {
        await updateDoc(doc(db, 'apps', editingApp.id), {
          ...formData,
          position: Number(formData.position)
        });
      } else {
        await addDoc(collection(db, 'apps'), {
          ...formData,
          position: Number(formData.position),
          createdAt: Timestamp.now()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingApp ? OperationType.UPDATE : OperationType.CREATE, 'apps');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'apps', id));
      setAppToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `apps/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (app: ExternalApp) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      icon: app.icon,
      url: app.url,
      description: app.description || '',
      position: app.position,
      isInternal: !!app.isInternal
    });
    setIsFormOpen(true);
  };

  const movePosition = async (app: ExternalApp, direction: 'up' | 'down') => {
    const newPos = direction === 'up' ? app.position - 1 : app.position + 1;
    if (newPos < 0) return;
    try {
      await updateDoc(doc(db, 'apps', app.id), { position: newPos });
    } catch (error) {
      console.error("Error updating position:", error);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Ứng dụng</h1>
          <p className="text-slate-500 text-sm">Quản lý danh sách ứng dụng hiển thị tại trang chủ</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" />
          Thêm ứng dụng
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {externalApps.map((app) => (
          <div key={app.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                {app.icon.startsWith('http') ? (
                  <img src={app.icon} alt={app.name} className="w-8 h-8 object-contain" />
                ) : (
                  <Layout className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => movePosition(app, 'up')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600">
                  <MoveUp className="w-4 h-4" />
                </button>
                <button onClick={() => movePosition(app, 'down')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600">
                  <MoveDown className="w-4 h-4" />
                </button>
                <button onClick={() => handleEdit(app)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setAppToDelete(app.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">{app.name}</h3>
                {app.isInternal && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Hệ thống chính</span>}
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{app.description}</p>
            </div>

            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vị trí: {app.position}</div>
              <a href={app.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 text-xs font-bold hover:underline">
                <ExternalLink className="w-3 h-3" />
                {app.isInternal ? 'Vào cổng' : 'Truy cập'}
              </a>
            </div>
          </div>
        ))}
      </div>

      {appToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 text-sm mb-6">Bạn có chắc chắn muốn xóa ứng dụng này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setAppToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(appToDelete)}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all text-sm shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {loading ? 'Đang xóa...' : 'Xóa ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingApp ? 'Sửa ứng dụng' : 'Thêm ứng dụng mới'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Tên ứng dụng</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Biểu tượng (Icon)</label>
                  <div className="flex gap-2">
                    <input
                      required
                      type="text"
                      value={formData.icon}
                      onChange={e => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="Icon name or URL"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Tên Lucide Icon hoặc URL ảnh</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Vị trí</label>
                  <input
                    required
                    type="number"
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Đường dẫn truy cập</label>
                <input
                  required
                  type="text"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px]"
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isInternal"
                  checked={formData.isInternal}
                  onChange={e => setFormData({ ...formData, isInternal: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="isInternal" className="text-sm font-bold text-slate-700 cursor-pointer">
                  Đây là ứng dụng nội bộ (Internal Portal)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
