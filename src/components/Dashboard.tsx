import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfDay, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, User as UserIcon, Clock, Info, Calendar, CheckCircle2, AlertCircle, X, BarChart3, PieChart as PieChartIcon, TrendingUp, Target, Trophy, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Task, UserProfile, Indicator, Project } from '../types';
import { cn } from '../lib/utils';
import MockDataSeeder from './MockDataSeeder';
import EvaluationDashboard from './EvaluationDashboard';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { startOfQuarter, endOfQuarter, isWithinInterval } from 'date-fns';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#8b5cf6', '#ec4899'];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const isWorkingHour = (hour: number) => {
  return (hour >= 7 && hour < 11) || (hour >= 13 && hour < 17);
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { tasks, users, indicators, projects, loading } = useData();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const activeUsers = users.filter(u => u.status === 'active');

  // Workload Analysis
  const workloadStats = useMemo(() => {
    if (loading) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const stats = activeUsers.map(user => {
      const userTasks = tasks.filter(t => t.assigneeId === user.uid);
      const dayTasks = userTasks.filter(t => t.timeSlots?.some(s => s.date === dateStr));
      
      const hourlyLoad = HOURS.map(hour => {
        const hourTasks = dayTasks.filter(t => 
          t.timeSlots?.find(s => s.date === dateStr)?.hours?.includes(hour)
        );
        return hourTasks.length;
      });

      const totalHours = hourlyLoad.reduce((a, b) => a + b, 0);
      const freeHours = hourlyLoad.filter((load, h) => isWorkingHour(h) && load === 0).length;
      const overloadedHours = hourlyLoad.filter((load, h) => isWorkingHour(h) && load > 1).length;

      return {
        uid: user.uid,
        name: user.displayName || 'N/A',
        role: user.role,
        photoURL: user.photoURL,
        totalHours,
        freeHours,
        overloadedHours,
        hourlyLoad
      };
    });

    return stats.sort((a, b) => b.totalHours - a.totalHours);
  }, [tasks, activeUsers, selectedDate, loading]);

  const overallStats = useMemo(() => {
    if (loading) return { totalTasks: 0, leaderAssigned: 0, selfRegistered: 0, totalProjects: 0 };
    const totalTasks = tasks.length;
    const leaderAssigned = tasks.filter(t => t.taskType === 'Lãnh đạo giao').length;
    const selfRegistered = tasks.filter(t => t.taskType === 'Tự đăng ký').length;
    const totalProjects = projects.length;
    
    return { totalTasks, leaderAssigned, selfRegistered, totalProjects };
  }, [tasks, projects, loading]);

  const leaderboard = useMemo(() => {
    if (loading) return [];
    const now = new Date();
    const range = { start: startOfQuarter(now), end: now };
    const quarterTasks = tasks.filter(t => {
      const assignedAt = t.assignedAt ? t.assignedAt.toDate() : t.createdAt.toDate();
      const inRange = isWithinInterval(assignedAt, range);
      if (!inRange) return false;
      
      // Exclude tasks that are 'Đang thực hiện' AND 'Đúng tiến độ'
      if (t.status === 'Đang thực hiện' && t.progressStatus === 'Đúng tiến độ') return false;
      
      return true;
    });
    
    const evaluatableUsers = activeUsers.filter(u => u.role !== 'Admin' && u.role !== 'Chánh Văn phòng');

    return evaluatableUsers.map(user => {
      const userTasks = quarterTasks.filter(t => t.assigneeId === user.uid);
      const total = userTasks.length;
      if (total === 0) return { ...user, score: 0 };

      const completed = userTasks.filter(t => t.status === 'Hoàn thành').length;
      const onTime = userTasks.filter(t => t.status === 'Hoàn thành' && t.progressStatus !== 'Chậm tiến độ').length;
      const qualityApproved = userTasks.filter(t => t.status === 'Hoàn thành' && (t.qualityStatus === 'Đạt' || t.qualityStatus === 'Xuất sắc')).length;
      
      const qRate = (completed / total) * 100;
      const tRate = (onTime / total) * 100;
      const qlRate = (qualityApproved / total) * 100;

      let score = 0;
      if (qRate === 100) score += 15; else if (qRate >= 95) score += 10; else if (qRate >= 90) score += 5;
      if (tRate === 100) score += 15; else if (tRate >= 95) score += 10; else if (tRate >= 90) score += 5;
      if (qlRate >= 95) score += 30; else if (qlRate >= 90) score += 25; else if (qlRate >= 80) score += 20; else if (qlRate >= 75) score += 15; else if (qlRate >= 70) score += 10;

      return { ...user, score };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [tasks, activeUsers, loading]);

  const indicatorStats = useMemo(() => {
    if (loading) return [];
    const fieldGroups: { [key: string]: { total: number, completed: number, target: number, current: number } } = {};
    
    indicators.forEach(indicator => {
      if (!fieldGroups[indicator.field]) {
        fieldGroups[indicator.field] = { total: 0, completed: 0, target: 0, current: 0 };
      }
      fieldGroups[indicator.field].total++;
      if (indicator.status === 'Đã duyệt') {
        fieldGroups[indicator.field].completed++;
        fieldGroups[indicator.field].target += indicator.targetValue;
        fieldGroups[indicator.field].current += indicator.currentValue;
      }
    });

    return Object.entries(fieldGroups).map(([field, stats]) => ({
      field,
      count: stats.total,
      progress: stats.target > 0 ? Math.min(100, Math.round((stats.current / stats.target) * 100)) : 0
    })).sort((a, b) => b.count - a.count);
  }, [indicators, loading]);

  const getTasksForUserAtHour = (userUid: string, date: Date, hour: number) => {
    if (loading) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (task.assigneeId !== userUid) return false;
      const slot = task.timeSlots?.find(s => s.date === dateStr);
      return slot?.hours?.includes(hour);
    });
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const colls = ['tasks', 'indicators', 'evaluations'];
      for (const collName of colls) {
        const snapshot = await getDocs(collection(db, collName));
        if (snapshot.empty) continue;

        const docs = snapshot.docs;
        // Batch deletes in chunks of 500
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setShowConfirmDelete(false);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error clearing data:', error);
      setDeleteError(error.message || 'Lỗi khi xóa dữ liệu. Vui lòng kiểm tra quyền truy cập.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Đang tải dữ liệu Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {deleteSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
          Đã xóa toàn bộ dữ liệu thành công.
        </div>
      )}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa dữ liệu</h3>
            <p className="text-slate-600 mb-4">
              Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu công việc, chỉ tiêu và đánh giá? Hành động này không thể hoàn tác.
            </p>
            
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  'Xác nhận xóa'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          Dashboard Công việc - Thời gian
        </h1>
        <div className="flex items-center gap-2">
          {profile?.role === 'Admin' && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all text-sm font-medium border border-red-100"
            >
              <Trash2 className="w-4 h-4" />
              Xóa dữ liệu
            </button>
          )}
          {profile?.role === 'Admin' && <MockDataSeeder />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Nhiệm vụ lớn</h3>
          <div className="text-3xl font-bold text-blue-600">{overallStats.totalProjects}</div>
          <div className="text-xs text-slate-400 mt-1">Dự án trọng điểm</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Tổng số công việc</h3>
          <div className="text-3xl font-bold text-slate-800">{overallStats.totalTasks}</div>
          <div className="text-xs text-slate-400 mt-1">Trong hệ thống</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Lãnh đạo giao</h3>
          <div className="text-3xl font-bold text-blue-600">{overallStats.leaderAssigned}</div>
          <div className="text-xs text-slate-400 mt-1">Công việc chỉ định</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Tự đăng ký</h3>
          <div className="text-3xl font-bold text-orange-600">{overallStats.selfRegistered}</div>
          <div className="text-xs text-slate-400 mt-1">Công việc chủ động</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Thống kê Chỉ tiêu theo Lĩnh vực
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {indicatorStats.map(stat => (
            <div key={stat.field} className="p-4 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.field}</span>
                <span className="text-[10px] font-bold text-blue-600">{stat.progress}%</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xl font-black text-slate-800">{stat.count}</div>
                <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap">CHỈ TIÊU</div>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    stat.progress >= 100 ? "bg-green-500" : "bg-blue-500"
                  )}
                  style={{ width: `${stat.progress}%` }}
                />
              </div>
            </div>
          ))}
          {indicatorStats.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 italic">
              Chưa có dữ liệu chỉ tiêu để thống kê
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold min-w-[120px] text-center">
            {format(selectedDate, 'dd/MM/yyyy')}
          </span>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-xs border-t sm:border-t-0 pt-2 sm:pt-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
            <span>Lãnh đạo giao</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded" />
            <span>Tự đăng ký</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-50 border border-slate-200 rounded" />
            <span>Giờ làm việc</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 p-3 border-b border-r border-slate-200 text-left min-w-[200px]">
                Nhân viên
              </th>
              {HOURS.map(hour => (
                <th 
                  key={hour} 
                  className={cn(
                    "p-2 border-b border-r border-slate-200 text-xs font-medium min-w-[60px] transition-colors",
                    isWorkingHour(hour) ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"
                  )}
                >
                  {hour.toString().padStart(2, '0')}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeUsers.map(user => (
              <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-200 flex items-center justify-center">
                        <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{user.displayName}</div>
                      <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-wider truncate">{user.role}</div>
                    </div>
                  </div>
                </td>
                {HOURS.map(hour => {
                  const hourTasks = getTasksForUserAtHour(user.uid, selectedDate, hour);
                  const hasTasks = hourTasks.length > 0;
                  const isOverloaded = hourTasks.length > 1;
                  
                  return (
                    <td 
                      key={hour} 
                      className={cn(
                        "p-1 border-b border-r border-slate-100 h-16 relative group transition-colors",
                        isWorkingHour(hour) ? (hasTasks ? (isOverloaded ? "bg-red-50" : "bg-white") : "bg-amber-50/30") : "bg-slate-50/50"
                      )}
                    >
                      {hasTasks && (
                        <div className="flex flex-col gap-1 h-full overflow-hidden">
                          {hourTasks.map(task => (
                            <div 
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={cn(
                                "text-[10px] p-1 rounded border border-slate-300 leading-tight truncate cursor-pointer transition-all hover:scale-105 shadow-sm",
                                task.taskType === 'Lãnh đạo giao' ? "bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200" :
                                "bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200"
                              )}
                            >
                              {task.taskType === 'Lãnh đạo giao' ? '⭐ ' : '📝 '}{task.title}
                            </div>
                          ))}
                        </div>
                      )}
                      {!hasTasks && isWorkingHour(hour) && (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-slate-300 italic">Trống</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Phân bổ Thời gian theo Nhân sự (Ngày {format(selectedDate, 'dd/MM')})
        </h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={workloadStats}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100} 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Bar name="Giờ có việc" dataKey="totalHours" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Cảnh báo Phân bổ (Giờ làm việc)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workloadStats.map(user => (
            <div key={user.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{user.role}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className={cn("text-lg font-bold", user.freeHours > 4 ? "text-amber-600" : "text-slate-400")}>
                    {user.freeHours}h
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase">Trống</div>
                </div>
                <div className="text-center">
                  <div className={cn("text-lg font-bold", user.overloadedHours > 0 ? "text-red-600" : "text-slate-400")}>
                    {user.overloadedHours}h
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase">Quá tải</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Bảng xếp hạng (Quý hiện tại)
          </h3>
          <button 
            onClick={() => navigate('/evaluation')}
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            Xem tất cả
          </button>
        </div>
        <div className="space-y-4">
          {leaderboard.map((user, idx) => (
            <div key={user.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white",
                  idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-orange-400" : "bg-slate-300"
                )}>
                  {idx + 1}
                </div>
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="text-sm font-bold text-slate-800">{user.displayName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-blue-600">{user.score}đ</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Điểm</div>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm italic">
              Chưa có dữ liệu xếp hạng
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={cn(
              "p-6 text-white flex items-center justify-between",
              selectedTask.taskType === 'Lãnh đạo giao' ? "bg-blue-600" : "bg-orange-600"
            )}>
              <div className="flex items-center gap-3">
                {selectedTask.taskType === 'Lãnh đạo giao' ? <CheckCircle2 className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                <div>
                  <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                  <p className="text-xs opacity-80 uppercase tracking-widest font-semibold">{selectedTask.taskType}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Hạn: {selectedTask.deadline ? format(selectedTask.deadline.toDate(), 'dd/MM/yyyy') : 'N/A'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Mô tả công việc</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedTask.description || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {users.find(u => u.uid === selectedTask.assigneeId)?.displayName?.[0]}
                  </div>
                  <span className="text-xs text-slate-500">Người thực hiện: <b>{users.find(u => u.uid === selectedTask.assigneeId)?.displayName}</b></span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedTask(null)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
