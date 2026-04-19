import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { format, addDays, startOfDay } from 'date-fns';
import { X, Calendar, Clock, User as UserIcon, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Task, UserRole, TimeSlot, TaskType, ProgressStatus } from '../types';
import { cn } from '../lib/utils';

interface TaskFormProps {
  onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const isWorkingHour = (hour: number) => {
  return (hour >= 7 && hour < 11) || (hour >= 13 && hour < 17);
};

export default function TaskForm({ onClose }: TaskFormProps) {
  const { profile } = useAuth();
  const { users, projects } = useData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Lãnh đạo giao');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('Chưa xác định');
  const [deadline, setDeadline] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [assignedAtDate, setAssignedAtDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUsers = users.filter(u => u.status === 'active');

  const toggleHour = (date: string, hour: number) => {
    setTimeSlots(prev => {
      const existingSlot = prev.find(s => s.date === date);
      if (existingSlot) {
        const newHours = existingSlot.hours.includes(hour)
          ? existingSlot.hours.filter(h => h !== hour)
          : [...existingSlot.hours, hour];
        
        if (newHours.length === 0) {
          return prev.filter(s => s.date !== date);
        }
        return prev.map(s => s.date === date ? { ...s, hours: newHours } : s);
      } else {
        return [...prev, { date, hours: [hour] }];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    // Validation
    const now = startOfDay(new Date());
    const start = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));
    const dead = startOfDay(new Date(deadline));

    if (!assigneeId) {
      setError('Vui lòng chọn nhân viên thực hiện.');
      return;
    }

    if (dead < now) {
      setError('Hạn công việc không thể ở trong quá khứ.');
      return;
    }

    if (start > end) {
      setError('Ngày bắt đầu không thể lớn hơn ngày kết thúc.');
      return;
    }

    if (end > dead) {
      setError('Ngày kết thúc phải nhỏ hơn hoặc bằng hạn của công việc.');
      return;
    }

    // Filter timeSlots to only include dates within the selected range
    const validTimeSlots = timeSlots.filter(slot => {
      const slotDate = startOfDay(new Date(slot.date));
      return slotDate >= start && slotDate <= end;
    });

    if (validTimeSlots.length === 0) {
      setError('Vui lòng chọn ít nhất một khung giờ thực hiện trong khoảng ngày đã chọn.');
      return;
    }

    setSubmitting(true);

    try {
      const newTask: any = {
        title,
        description,
        taskType,
        projectId: projectId || "", // Ensure it's always a string
        deadline: Timestamp.fromDate(new Date(deadline)),
        assignedAt: Timestamp.fromDate(new Date(assignedAtDate)),
        creatorId: profile.uid,
        assigneeId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'Chưa thực hiện',
        progressStatus,
        startDate,
        endDate,
        timeSlots: validTimeSlots,
      };

      const docRef = await addDoc(collection(db, 'tasks'), newTask);
      
      // Notify assignee via email
      try {
        const assignee = users.find(u => u.uid === assigneeId);
        await fetch('/api/notify-assignment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: docRef.id,
            assigneeEmail: assignee?.email,
            assigneeName: assignee?.displayName,
            title,
            creatorName: profile.displayName
          }),
        });
      } catch (error) {
        console.error('Failed to trigger email notification:', error);
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    } finally {
      setSubmitting(false);
    }
  };

  const dateRange = [];
  let current = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  while (current <= end) {
    dateRange.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Tạo Công Việc Mới</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên công việc</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nhập tên công việc..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loại công việc</label>
                <div className="flex gap-2">
                  {(['Lãnh đạo giao', 'Tự đăng ký'] as TaskType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTaskType(type)}
                      className={cn(
                        "flex-1 py-2 px-3 text-xs rounded-lg border transition-all",
                        taskType === type 
                          ? "bg-blue-50 border-blue-200 text-blue-600 font-semibold shadow-sm" 
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                  placeholder="Mô tả chi tiết nhiệm vụ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nhiệm vụ lớn (Tùy chọn)</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Không thuộc nhiệm vụ lớn nào</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Người thực hiện</label>
                <select
                  required
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn người thực hiện...</option>
                  {activeUsers.map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ tiến độ</label>
                <select
                  value={progressStatus}
                  onChange={e => setProgressStatus(e.target.value as ProgressStatus)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Chưa xác định">Chưa xác định</option>
                  <option value="Đúng tiến độ">Đúng tiến độ</option>
                  <option value="Chậm tiến độ">Chậm tiến độ</option>
                  <option value="Vượt tiến độ">Vượt tiến độ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hạn hoàn thành</label>
                <input
                  required
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày giao việc</label>
                <input
                  required
                  type="date"
                  value={assignedAtDate}
                  onChange={e => setAssignedAtDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Khung giờ thực hiện (Chuyên viên có thể bổ sung sau)
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {dateRange.map(date => (
                      <div key={date} className="p-3 border-b border-slate-100 last:border-0">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase">{format(new Date(date), 'dd/MM/yyyy')}</div>
                        <div className="grid grid-cols-8 gap-1">
                          {HOURS.map(hour => {
                            const isSelected = timeSlots.find(s => s.date === date)?.hours?.includes(hour);
                            const isWorking = isWorkingHour(hour);
                            return (
                              <button
                                key={hour}
                                type="button"
                                onClick={() => toggleHour(date, hour)}
                                className={cn(
                                  "h-8 text-[10px] rounded flex items-center justify-center transition-all border border-slate-200",
                                  isSelected ? "bg-blue-600 text-white shadow-md scale-105 border-blue-600" : 
                                  isWorking ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                )}
                              >
                                {hour}h
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title || !assigneeId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
          >
            {submitting ? 'Đang tạo...' : 'Tạo công việc'}
          </button>
        </div>
      </div>
    </div>
  );
}
