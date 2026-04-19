import { useState, FormEvent } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Schedule, ScheduleStatus } from '../types';
import { Plus, Trash2, CheckCircle, XCircle, Calendar, Clock, User, MapPin, Users, Filter, Save, X, Edit2, Code, Copy, Info, Grid } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

export default function ScheduleManagement() {
  const { schedules, loading: dataLoading } = useData();
  const { user, profile } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showApiInfo, setShowApiInfo] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ScheduleStatus | 'All'>('All');
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  const isLeader = profile?.role && ['Lãnh đạo', 'Chánh Văn phòng', 'Phó Chánh Văn phòng 1', 'Phó Chánh Văn phòng 2', 'Admin'].includes(profile.role);

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    title: '',
    chairperson: '',
    attendees: '',
    location: ''
  });

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      title: '',
      chairperson: '',
      attendees: '',
      location: ''
    });
    setEditingSchedule(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), {
          ...formData
        });
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...formData,
          status: 'Chờ duyệt',
          creatorId: user.uid,
          creatorEmail: user.email,
          createdAt: Timestamp.now()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingSchedule ? OperationType.UPDATE : OperationType.CREATE, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: ScheduleStatus) => {
    try {
      await updateDoc(doc(db, 'schedules', id), {
        status,
        approvedBy: user?.uid,
        approvedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setScheduleToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedules = schedules.filter(s => filter === 'All' || s.status === filter);

  return (
    <>
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Lịch làm việc</h1>
          <p className="text-slate-500 text-sm">Đăng ký và quản lý lịch họp, sự kiện công tác</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Chờ duyệt">⏳ Chờ duyệt</option>
              <option value="Đã duyệt">✅ Đã duyệt</option>
              <option value="Từ chối">❌ Từ chối</option>
            </select>
          </div>
          {isLeader && (
            <button
              onClick={() => setShowApiInfo(true)}
              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-sm shadow-sm"
            >
              <Code className="w-4 h-4 text-slate-400" />
              Tích hợp API
            </button>
          )}
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            Đăng ký lịch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredSchedules.map((schedule) => (
          <div key={schedule.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-md transition-all">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  schedule.status === 'Đã duyệt' ? "bg-green-100 text-green-700" :
                  schedule.status === 'Từ chối' ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                )}>
                  {schedule.status}
                </div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight">{schedule.title}</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-slate-700">{format(parseISO(schedule.date), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-slate-700">{schedule.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="truncate">Chủ trì: <b className="text-slate-700">{schedule.chairperson}</b></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="truncate">{schedule.location}</span>
                </div>
              </div>

              {schedule.attendees && (
                <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-xl">
                  <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div> Thành phần tham dự: <span className="text-slate-600 font-medium">{schedule.attendees}</span></div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0">
              {isLeader && schedule.status === 'Chờ duyệt' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(schedule.id, 'Đã duyệt')}
                    className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                    title="Duyệt lịch"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(schedule.id, 'Từ chối')}
                    className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                    title="Từ chối"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </>
              )}
              
              {(user?.uid === schedule.creatorId || isLeader) && (
                <button
                  onClick={() => {
                    setEditingSchedule(schedule);
                    setFormData({
                      date: schedule.date,
                      time: schedule.time,
                      title: schedule.title,
                      chairperson: schedule.chairperson,
                      attendees: schedule.attendees,
                      location: schedule.location
                    });
                    setIsFormOpen(true);
                  }}
                  className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
              
              {(user?.uid === schedule.creatorId || isLeader) && (
                <button
                  onClick={() => setScheduleToDelete(schedule.id)}
                  className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredSchedules.length === 0 && !dataLoading && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium">Chưa có lịch làm việc nào trong hệ thống</p>
          </div>
        )}
      </div>

      {scheduleToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 text-sm mb-6">Bạn có chắc chắn muốn xóa lịch này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(scheduleToDelete)}
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
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingSchedule ? 'Cập nhật lịch' : 'Đăng ký lịch làm việc'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Ngày diễn ra</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Giờ bắt đầu</label>
                  <input
                    required
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Tên cuộc họp / Sự kiện</label>
                <textarea
                  required
                  rows={2}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nhập nội dung chi tiết sự kiện..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Chủ trì</label>
                  <input
                    required
                    type="text"
                    value={formData.chairperson}
                    onChange={e => setFormData({ ...formData, chairperson: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Địa điểm</label>
                  <input
                    required
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Thành phần tham dự</label>
                <textarea
                  rows={3}
                  value={formData.attendees}
                  onChange={e => setFormData({ ...formData, attendees: e.target.value })}
                  placeholder="Danh sách cán bộ, đơn vị tham gia..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Đang lưu...' : 'Lưu đăng ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      {/* API Info Modal */}
      {showApiInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Code className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Tích hợp API Lịch làm việc</h2>
                    <p className="text-slate-400 text-xs font-medium">Hướng dẫn kết nối các ứng dụng khác</p>
                  </div>
                </div>
                <button onClick={() => setShowApiInfo(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-widest">
                  <Info className="w-4 h-4 text-blue-500" />
                  1. Lấy danh sách lịch công tác
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-black rounded uppercase">GET</span>
                    <code className="text-xs font-mono text-slate-600">/api/schedules?date=YYYY-MM-DD</code>
                  </div>
                  <p className="text-xs text-slate-500 italic">* Bỏ qua tham số date để lấy toàn bộ lịch.</p>
                  <div className="relative group">
                    <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] overflow-x-auto">
{`curl -X GET "${window.location.origin}/api/schedules?date=${format(new Date(), 'yyyy-MM-dd')}"`}
                    </pre>
                    <button 
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/schedules?date=${format(new Date(), 'yyyy-MM-dd')}`)}
                      className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-widest">
                  <Plus className="w-4 h-4 text-blue-500" />
                  2. Đăng ký lịch đơn lẻ
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase">POST</span>
                    <code className="text-xs font-mono text-slate-600">/api/schedules</code>
                  </div>
                  <div className="relative group">
                    <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] overflow-x-auto">
{`{
  "date": "2024-03-25",
  "time": "14:30",
  "title": "Họp triển khai ứng dụng",
  "location": "Phòng họp số 1",
  "chairperson": "Lãnh đạo VP",
  "attendees": "Toàn thể chuyên viên",
  "status": "Chờ duyệt"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-widest">
                  <Grid className="w-4 h-4 text-purple-500" />
                  3. Đăng ký hàng loạt (Bulk)
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-black rounded uppercase">POST</span>
                    <code className="text-xs font-mono text-slate-600">/api/schedules</code>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">Gửi danh sách (Array) các đối tượng lịch.</p>
                  <div className="relative group">
                    <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] overflow-x-auto">
{`[
  {
    "date": "2024-03-25",
    "time": "08:00",
    "title": "Sự kiện 1",
    "location": "Phòng A"
  },
  {
    "date": "2024-03-25",
    "time": "14:00",
    "title": "Sự kiện 2",
    "location": "Phòng B"
  }
]`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowApiInfo(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
