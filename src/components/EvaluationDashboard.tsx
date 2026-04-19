import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Task, UserProfile, TaskStatus, ProgressStatus, QualityStatus } from '../types';
import { cn } from '../lib/utils';
import { Trophy, Target, Clock, Star, TrendingUp, Users, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

type EvaluationPeriod = 'quarter' | 'year' | 'custom';

export default function EvaluationDashboard() {
  const { tasks, users } = useData();
  const [period, setPeriod] = useState<EvaluationPeriod>('quarter');
  const [customStart, setCustomStart] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'quarter') {
      return { start: startOfQuarter(now), end: endOfDay(now) };
    }
    if (period === 'year') {
      return { start: startOfYear(now), end: endOfDay(now) };
    }
    return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
  }, [period, customStart, customEnd]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const assignedAt = task.assignedAt ? task.assignedAt.toDate() : task.createdAt.toDate();
      const inRange = isWithinInterval(assignedAt, dateRange);
      if (!inRange) return false;
      
      // Exclude tasks that are 'Đang thực hiện' AND 'Đúng tiến độ'
      if (task.status === 'Đang thực hiện' && task.progressStatus === 'Đúng tiến độ') return false;
      
      return true;
    });
  }, [tasks, dateRange]);

  const specialistStats = useMemo(() => {
    const specialists = users.filter(u => 
      u.role !== 'Admin' && 
      u.role !== 'Chánh Văn phòng' && 
      (u.role === 'Chuyên viên' || u.role === 'Lãnh đạo' || u.role === 'Phó Chánh Văn phòng 1' || u.role === 'Phó Chánh Văn phòng 2')
    );
    
    return specialists.map(user => {
      const userTasks = filteredTasks.filter(t => t.assigneeId === user.uid);
      const total = userTasks.length;
      
      if (total === 0) {
        return {
          user,
          total: 0,
          completed: 0,
          onTime: 0,
          qualityApproved: 0,
          quantityScore: 0,
          timelinessScore: 0,
          qualityScore: 0,
          totalScore: 0,
          quantityRate: 0,
          timelinessRate: 0,
          qualityRate: 0
        };
      }

      const completed = userTasks.filter(t => t.status === 'Hoàn thành').length;
      const onTime = userTasks.filter(t => t.status === 'Hoàn thành' && t.progressStatus !== 'Chậm tiến độ').length;
      const qualityApproved = userTasks.filter(t => t.status === 'Hoàn thành' && (t.qualityStatus === 'Đạt' || t.qualityStatus === 'Xuất sắc')).length;
      
      const quantityRate = (completed / total) * 100;
      const timelinessRate = (onTime / total) * 100;
      const qualityRate = (qualityApproved / total) * 100;

      // Quantity Score (15)
      let quantityScore = 0;
      if (quantityRate === 100) quantityScore = 15;
      else if (quantityRate >= 95) quantityScore = 10;
      else if (quantityRate >= 90) quantityScore = 5;

      // Timeliness Score (15)
      let timelinessScore = 0;
      if (timelinessRate === 100) timelinessScore = 15;
      else if (timelinessRate >= 95) timelinessScore = 10;
      else if (timelinessRate >= 90) timelinessScore = 5;

      // Quality Score (30)
      let qualityScore = 0;
      if (qualityRate >= 95) qualityScore = 30;
      else if (qualityRate >= 90) qualityScore = 25;
      else if (qualityRate >= 80) qualityScore = 20;
      else if (qualityRate >= 75) qualityScore = 15;
      else if (qualityRate >= 70) qualityScore = 10;

      return {
        user,
        total,
        completed,
        onTime,
        qualityApproved,
        quantityRate,
        timelinessRate,
        qualityRate,
        quantityScore,
        timelinessScore,
        qualityScore,
        totalScore: quantityScore + timelinessScore + qualityScore
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [filteredTasks, users]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Phân hệ Đánh giá Kết quả
          </h2>
          <p className="text-slate-500">
            {period === 'quarter' ? `Quý ${Math.floor(new Date().getMonth() / 3) + 1} / ${new Date().getFullYear()}` : 
             period === 'year' ? `Năm ${new Date().getFullYear()}` : 
             `Từ ${format(dateRange.start, 'dd/MM/yyyy')} đến ${format(dateRange.end, 'dd/MM/yyyy')}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPeriod('quarter')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                period === 'quarter' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Quý hiện tại
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                period === 'year' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Năm hiện tại
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                period === 'custom' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Tùy chọn
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng nhiệm vụ</div>
          <div className="text-3xl font-black text-slate-800">{filteredTasks.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Đã hoàn thành</div>
          <div className="text-3xl font-black text-green-600">
            {filteredTasks.filter(t => t.status === 'Hoàn thành').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Đúng tiến độ</div>
          <div className="text-3xl font-black text-blue-600">
            {filteredTasks.filter(t => t.status === 'Hoàn thành' && t.progressStatus !== 'Chậm tiến độ').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Đạt chất lượng</div>
          <div className="text-3xl font-black text-purple-600">
            {filteredTasks.filter(t => t.status === 'Hoàn thành' && (t.qualityStatus === 'Đạt' || t.qualityStatus === 'Xuất sắc')).length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {specialistStats.map((stat, idx) => (
          <div key={stat.user.uid} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group">
            <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex items-center gap-4 min-w-[280px]">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:border-blue-200 transition-colors">
                    {stat.user.photoURL ? (
                      <img src={stat.user.photoURL} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className={cn(
                    "absolute -top-2 -left-2 w-7 h-7 text-white text-xs font-black rounded-lg flex items-center justify-center border-2 border-white shadow-sm",
                    idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-orange-400" : "bg-slate-800"
                  )}>
                    {idx + 1}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{stat.user.displayName}</h3>
                  <p className="text-xs text-slate-400 mb-2">{stat.user.role}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                      {stat.total} Nhiệm vụ
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số lượng (15đ)</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-2xl font-black text-slate-800">{stat.quantityScore}</div>
                    <div className="text-[10px] font-bold text-blue-600">{stat.quantityRate.toFixed(1)}%</div>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${stat.quantityRate}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ (15đ)</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-2xl font-black text-slate-800">{stat.timelinessScore}</div>
                    <div className="text-[10px] font-bold text-amber-600">{stat.timelinessRate.toFixed(1)}%</div>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${stat.timelinessRate}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-purple-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất lượng (30đ)</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-2xl font-black text-slate-800">{stat.qualityScore}</div>
                    <div className="text-[10px] font-bold text-purple-600">{stat.qualityRate.toFixed(1)}%</div>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full transition-all duration-1000" style={{ width: `${stat.qualityRate}%` }} />
                  </div>
                </div>
              </div>

              <div className="lg:w-36 flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl shadow-xl group-hover:bg-blue-600 transition-all duration-500">
                <div className="text-[10px] font-bold uppercase opacity-60 mb-1">Tổng điểm</div>
                <div className="text-4xl font-black">{stat.totalScore}</div>
                <div className="mt-2 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest">
                  {stat.totalScore >= 55 ? 'Xuất sắc' : stat.totalScore >= 45 ? 'Tốt' : stat.totalScore >= 30 ? 'Khá' : 'Trung bình'}
                </div>
              </div>
            </div>
          </div>
        ))}

        {specialistStats.length === 0 && (
          <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium">Không có dữ liệu đánh giá cho khoảng thời gian này.</p>
          </div>
        )}
      </div>
    </div>
  );
}
