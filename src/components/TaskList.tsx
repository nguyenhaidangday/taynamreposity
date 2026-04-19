import { useState, useMemo } from 'react';
import { doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { format, subDays, isAfter } from 'date-fns';
import { Search, Filter, MoreVertical, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, User as UserIcon, Settings2, FileSpreadsheet, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Task, TaskStatus } from '../types';
import { cn } from '../lib/utils';
import TaskUpdateForm from './TaskUpdateForm';
import TaskImport from './TaskImport';
import TaskForm from './TaskForm';

const STATUS_COLORS = {
  'Chưa thực hiện': 'bg-slate-100 text-slate-600',
  'Đang thực hiện': 'bg-blue-100 text-blue-600',
  'Chờ phê duyệt': 'bg-amber-100 text-amber-600',
  'Hoàn thành': 'bg-green-100 text-green-600',
  'Quá hạn': 'bg-red-100 text-red-600',
};

export default function TaskList() {
  const { profile } = useAuth();
  const { tasks, users, loading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [timeRange, setTimeRange] = useState<number | 'All'>(15);

  const filteredTasks = useMemo(() => {
    if (loading) return [];
    const now = new Date();
    
    return tasks
      .filter(task => {
        if (timeRange !== 'All') {
          const rangeDate = subDays(now, timeRange);
          const assignedAt = task.assignedAt ? task.assignedAt.toDate() : task.createdAt.toDate();
          if (!isAfter(assignedAt, rangeDate)) return false;
        }

        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             task.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = a.assignedAt ? a.assignedAt.toDate().getTime() : a.createdAt.toDate().getTime();
        const dateB = b.assignedAt ? b.assignedAt.toDate().getTime() : b.createdAt.toDate().getTime();
        return dateB - dateA;
      });
  }, [tasks, searchTerm, statusFilter, timeRange, loading]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleUpdateStatus = async (task: Task, status: TaskStatus) => {
    if (!profile) return;
    try {
      const updates: any = { status };
      await updateDoc(doc(db, 'tasks', task.id), updates);
      
      try {
        const creator = users.find(u => u.uid === task.creatorId);
        await fetch('/api/notify-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            creatorEmail: creator?.email,
            creatorName: creator?.displayName,
            title: task.title,
            updaterName: profile.displayName,
            status,
          }),
        });
      } catch (error) {
        console.error('Failed to trigger update notification:', error);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete));
      setTaskToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskToDelete}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Đang tải danh sách công việc...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-600 mb-6">Bạn có chắc chắn muốn xóa công việc này? Hành động này không thể hoàn tác.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteTask}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold shadow-lg shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            Tạo công việc
          </button>
          <button 
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-sm font-bold shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Nhập từ Excel
          </button>
          
          <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={timeRange}
              onChange={e => {
                const val = e.target.value;
                setTimeRange(val === 'All' ? 'All' : parseInt(val));
                setCurrentPage(1);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 ngày qua</option>
              <option value={15}>15 ngày qua</option>
              <option value={30}>30 ngày qua</option>
              <option value="All">Tất cả thời gian</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Chưa thực hiện">Chưa thực hiện</option>
              <option value="Đang thực hiện">Đang thực hiện</option>
              <option value="Chờ phê duyệt">Chờ phê duyệt</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Quá hạn">Quá hạn</option>
            </select>

            <select
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 dòng/trang</option>
              <option value={20}>20 dòng/trang</option>
              <option value={30}>30 dòng/trang</option>
              <option value={40}>40 dòng/trang</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="p-4 font-bold">Nhiệm vụ</th>
                <th className="p-4 font-bold">Trạng thái & Mức độ</th>
                <th className="p-4 font-bold">Thời gian</th>
                <th className="p-4 font-bold">Nhân sự</th>
                <th className="p-4 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedTasks.map(task => {
                const assignee = users.find(u => u.uid === task.assigneeId);
                const creator = users.find(u => u.uid === task.creatorId);
                
                return (
                  <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 align-top max-w-md">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", 
                          task.taskType === 'Lãnh đạo giao' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {task.taskType}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1 break-words leading-relaxed">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-2">
                        <span className={cn("inline-flex px-2 py-1 rounded-lg text-xs font-medium w-fit", STATUS_COLORS[task.status])}>
                          {task.status}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {task.progressStatus && task.progressStatus !== 'Chưa xác định' && (
                            <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase", 
                              task.progressStatus === 'Chậm tiến độ' ? "bg-red-50 text-red-600 border border-red-100" :
                              task.progressStatus === 'Vượt tiến độ' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                              "bg-green-50 text-green-600 border border-green-100"
                            )}>
                              {task.progressStatus}
                            </span>
                          )}
                          {task.qualityStatus && task.qualityStatus !== 'Chưa đánh giá' && (
                            <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase", 
                              task.qualityStatus === 'Đạt' || task.qualityStatus === 'Xuất sắc' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                            )}>
                              {task.qualityStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="w-16">Giao việc:</span>
                          <span className="font-medium text-slate-600">
                            {task.assignedAt ? format(task.assignedAt.toDate(), 'dd/MM/yyyy') : format(task.createdAt.toDate(), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="w-16">Thực hiện:</span>
                          <span className="font-medium text-slate-600">
                            {format(new Date(task.startDate), 'dd/MM')} - {format(new Date(task.endDate), 'dd/MM')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="w-16">Hạn chót:</span>
                          <span className="font-bold text-red-500">
                            {task.deadline ? format(task.deadline.toDate(), 'dd/MM/yyyy') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {assignee?.photoURL ? (
                            <img src={assignee.photoURL} className="w-5 h-5 rounded-full border border-white shadow-sm" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                              <UserIcon className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                          )}
                          <span className="text-xs text-slate-600 font-medium">{assignee?.displayName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Giao bởi: {creator?.displayName}</div>
                      </div>
                    </td>
                    <td className="p-4 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setEditingTask(task)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(task, 'Hoàn thành')}
                          className="p-2 hover:bg-green-50 text-green-600 rounded-xl transition-colors"
                          title="Hoàn thành"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        {(profile?.role === 'Admin' || profile?.role === 'Chánh Văn phòng' || profile?.uid === task.creatorId) && (
                          <button 
                            onClick={() => setTaskToDelete(task.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedTasks.map(task => {
            const assignee = users.find(u => u.uid === task.assigneeId);
            const creator = users.find(u => u.uid === task.creatorId);
            
            return (
              <div key={task.id} className="p-4 space-y-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", 
                        task.taskType === 'Lãnh đạo giao' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {task.taskType}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase", STATUS_COLORS[task.status])}>
                        {task.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 break-words leading-relaxed mb-1">
                      {task.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingTask(task)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {(profile?.role === 'Admin' || profile?.role === 'Chánh Văn phòng' || profile?.uid === task.creatorId) && (
                      <button 
                        onClick={() => setTaskToDelete(task.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="space-y-1">
                    <div className="text-slate-400">Thời gian</div>
                    <div className="font-medium text-slate-700">
                      {format(new Date(task.startDate), 'dd/MM')} - {format(new Date(task.endDate), 'dd/MM')}
                    </div>
                    <div className="font-bold text-red-500">
                      Hạn: {task.deadline ? format(task.deadline.toDate(), 'dd/MM/yyyy') : 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400">Người thực hiện</div>
                    <div className="flex items-center gap-2">
                      {assignee?.photoURL ? (
                        <img src={assignee.photoURL} className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center">
                          <UserIcon className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      )}
                      <span className="font-medium text-slate-700">{assignee?.displayName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <div className="text-[10px] text-slate-400">Từ: {creator?.displayName}</div>
                  <button 
                    onClick={() => handleUpdateStatus(task, 'Hoàn thành')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[11px] font-bold border border-green-100"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Hoàn thành
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTasks.length === 0 && (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">Không tìm thấy công việc nào trong 15 ngày qua.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTasks.length)} trong tổng số {filteredTasks.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-white rounded-lg disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-8 h-8 text-xs font-bold rounded-lg transition-all",
                      currentPage === page 
                        ? "bg-blue-600 text-white shadow-md" 
                        : "hover:bg-white text-slate-500"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-white rounded-lg disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {editingTask && (
        <TaskUpdateForm 
          task={editingTask} 
          onClose={() => setEditingTask(null)} 
        />
      )}

      {showImport && (
        <TaskImport 
          onClose={() => setShowImport(false)} 
        />
      )}

      {showCreateForm && (
        <TaskForm 
          onClose={() => setShowCreateForm(false)} 
        />
      )}
    </div>
  );
}
