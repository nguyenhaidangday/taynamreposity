import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format, addDays, startOfDay } from 'date-fns';
import { X, Clock, BarChart, MessageSquare, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Task, TimeSlot, TaskStatus, ProgressStatus, QualityStatus } from '../types';
import { cn } from '../lib/utils';

import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';

interface TaskUpdateFormProps {
  task: Task;
  onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const isWorkingHour = (hour: number) => {
  return (hour >= 7 && hour < 11) || (hour >= 13 && hour < 17);
};

export default function TaskUpdateForm({ task, onClose }: TaskUpdateFormProps) {
  const { profile } = useAuth();
  const { users, projects } = useData();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [projectId, setProjectId] = useState(task.projectId || '');
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>(task.progressStatus || 'Chưa xác định');
  const [qualityStatus, setQualityStatus] = useState<QualityStatus>(task.qualityStatus || 'Chưa đánh giá');
  const [assignedAtDate, setAssignedAtDate] = useState(format(task.assignedAt ? task.assignedAt.toDate() : task.createdAt.toDate(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(task.timeSlots || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const start = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));
    const dead = startOfDay(task.deadline.toDate());

    if (start > end) {
      setError('Ngày bắt đầu không thể lớn hơn ngày kết thúc.');
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
      const estimatedHours = validTimeSlots.reduce((acc, slot) => acc + (slot.hours?.length || 0), 0);
      const updates: any = {
        status,
        progressStatus,
        qualityStatus,
        assignedAt: Timestamp.fromDate(new Date(assignedAtDate)),
        timeSlots: validTimeSlots,
        estimatedHours,
        startDate,
        endDate,
        updatedAt: Timestamp.now()
      };

      if (projectId) {
        updates.projectId = projectId;
      } else {
        updates.projectId = ""; // Use empty string instead of null to satisfy rules
      }

      if (status === 'Hoàn thành') {
        // No more progress or qualityStatus
      }

      await updateDoc(doc(db, 'tasks', task.id), updates);

      // Notify creator via email
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

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
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

  const canAssessQuality = profile.role === 'Admin' || profile.role === 'Lãnh đạo' || profile.role === 'Chánh Văn phòng' || profile.role === 'Phó Chánh Văn phòng 1' || profile.role === 'Phó Chánh Văn phòng 2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Cập nhật Tiến độ & Thời gian</h2>
            <p className="text-sm text-slate-500">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhiệm vụ lớn</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái công việc</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Chưa thực hiện', 'Đang thực hiện', 'Chờ phê duyệt', 'Hoàn thành'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s as TaskStatus)}
                      className={cn(
                        "py-2 px-3 text-xs rounded-lg border transition-all",
                        status === s 
                          ? "bg-blue-50 border-blue-200 text-blue-600 font-semibold shadow-sm" 
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mức độ tiến độ</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Đúng tiến độ', 'Chậm tiến độ', 'Vượt tiến độ', 'Chưa xác định'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProgressStatus(p as ProgressStatus)}
                      className={cn(
                        "py-2 px-3 text-xs rounded-lg border transition-all",
                        progressStatus === p 
                          ? "bg-blue-50 border-blue-200 text-blue-600 font-semibold shadow-sm" 
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {canAssessQuality && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Đánh giá chất lượng</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Đạt', 'Không đạt', 'Xuất sắc', 'Chưa đánh giá'].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQualityStatus(q as QualityStatus)}
                        className={cn(
                          "py-2 px-3 text-xs rounded-lg border transition-all",
                          qualityStatus === q 
                            ? "bg-blue-50 border-blue-200 text-blue-600 font-semibold shadow-sm" 
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Thời gian thực hiện
              </label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Ngày giao việc</label>
                  <input
                    type="date"
                    value={assignedAtDate}
                    onChange={e => setAssignedAtDate(e.target.value)}
                    className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                  {dateRange.map(date => (
                    <div key={date} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center justify-between">
                        <span>{format(new Date(date), 'dd/MM/yyyy')}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
                          {timeSlots.find(s => s.date === date)?.hours?.length || 0} giờ
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                          {HOURS.map(hour => {
                            const isSelected = timeSlots.find(s => s.date === date)?.hours?.includes(hour);
                            const isWorking = isWorkingHour(hour);
                            return (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => toggleHour(date, hour)}
                              className={cn(
                                "h-9 text-[10px] rounded-lg flex items-center justify-center transition-all border border-slate-200",
                                isSelected 
                                  ? "bg-blue-600 border-blue-600 text-white shadow-md scale-105 z-10" 
                                  : isWorking 
                                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" 
                                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
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
              <p className="text-[10px] text-slate-400 mt-2 italic">
                * Tổng cộng: {timeSlots.reduce((acc, slot) => acc + (slot.hours?.length || 0), 0)} giờ thực hiện.
              </p>
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
            disabled={submitting}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 font-semibold"
          >
            {submitting ? 'Đang lưu...' : 'Lưu cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
}
