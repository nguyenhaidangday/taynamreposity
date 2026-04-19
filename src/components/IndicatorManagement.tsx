import React, { useState, useMemo } from 'react';
import { doc, updateDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { Target, Plus, Search, Filter, CheckCircle2, XCircle, Clock, Edit2, Trash2, TrendingUp, User as UserIcon } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Indicator, IndicatorStatus, IndicatorPeriodType } from '../types';
import { cn } from '../lib/utils';
import IndicatorForm from './IndicatorForm';

const STATUS_COLORS = {
  'Chờ duyệt': 'bg-amber-100 text-amber-700 border-amber-200',
  'Đã duyệt': 'bg-green-100 text-green-700 border-green-200',
  'Từ chối': 'bg-red-100 text-red-700 border-red-200',
};

export default function IndicatorManagement() {
  const { profile } = useAuth();
  const { indicators, users } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<IndicatorStatus | 'All'>('All');
  const [periodTypeFilter, setPeriodTypeFilter] = useState<IndicatorPeriodType | 'All'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<{ id: string, value: number } | null>(null);
  const [indicatorToDelete, setIndicatorToDelete] = useState<string | null>(null);

  const isLanhDao = profile?.role === 'Lãnh đạo' || profile?.role === 'Chánh Văn phòng' || profile?.role === 'Admin';

  const fields = useMemo(() => {
    const allFields = indicators.map(i => i.field);
    return ['All', ...Array.from(new Set(allFields))];
  }, [indicators]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter(i => {
      const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesField = fieldFilter === 'All' || i.field === fieldFilter;
      const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
      const matchesPeriodType = periodTypeFilter === 'All' || i.periodType === periodTypeFilter;
      return matchesSearch && matchesField && matchesStatus && matchesPeriodType;
    });
  }, [indicators, searchTerm, fieldFilter, statusFilter, periodTypeFilter]);

  const handleUpdateStatus = async (id: string, status: IndicatorStatus) => {
    if (!isLanhDao) return;
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'indicators', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `indicators/${id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateValue = async (id: string, value: number) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'indicators', id), { 
        currentValue: value,
        lastUpdatedAt: Timestamp.now()
      });
      setEditingValue(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `indicators/${id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!indicatorToDelete) return;
    try {
      await deleteDoc(doc(db, 'indicators', indicatorToDelete));
      setIndicatorToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `indicators/${indicatorToDelete}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {indicatorToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-600 mb-6">Bạn có chắc chắn muốn xóa chỉ tiêu này? Hành động này không thể hoàn tác.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIndicatorToDelete(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Quản lý Chỉ tiêu Phát triển
          </h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi và cập nhật các chỉ tiêu kinh tế - xã hội</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" />
          {isLanhDao ? 'Thiết lập Chỉ tiêu' : 'Đăng ký Chỉ tiêu'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm chỉ tiêu..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
          >
            {fields.map(f => (
              <option key={f} value={f}>{f === 'All' ? 'Tất cả lĩnh vực' : f}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-400" />
          <select
            value={periodTypeFilter}
            onChange={e => setPeriodTypeFilter(e.target.value as any)}
            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
          >
            <option value="All">Tất cả loại</option>
            <option value="Năm">Năm</option>
            <option value="Quý">Quý</option>
            <option value="Giai đoạn">Giai đoạn</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Từ chối">Từ chối</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredIndicators.map(indicator => {
          const assignee = users.find(u => u.uid === indicator.assigneeId);
          const progress = Math.min(100, Math.round((indicator.currentValue / indicator.targetValue) * 100));
          const isEditing = editingValue?.id === indicator.id;

          return (
            <div key={indicator.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                      {indicator.field}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                      {indicator.periodType}: {indicator.periodValue}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                      STATUS_COLORS[indicator.status]
                    )}>
                      {indicator.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{indicator.name}</h3>
                </div>
                {(isLanhDao || profile?.uid === indicator.creatorId) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {indicator.status === 'Chờ duyệt' && isLanhDao && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(indicator.id, 'Đã duyệt')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Phê duyệt"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(indicator.id, 'Từ chối')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Từ chối"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => setIndicatorToDelete(indicator.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Mục tiêu</div>
                  <div className="text-xl font-black text-slate-800">
                    {indicator.targetValue} <span className="text-xs font-normal text-slate-500">{indicator.unit}</span>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 relative">
                  <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">Thực hiện</div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        autoFocus
                        value={editingValue.value}
                        onChange={e => setEditingValue({ ...editingValue, value: Number(e.target.value) })}
                        className="w-full bg-white border border-blue-200 rounded p-1 text-sm outline-none"
                      />
                      <button 
                        onClick={() => handleUpdateValue(indicator.id, editingValue.value)}
                        className="text-blue-600"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-black text-blue-700">
                        {indicator.currentValue} <span className="text-xs font-normal text-blue-500">{indicator.unit}</span>
                      </div>
                      {indicator.status === 'Đã duyệt' && (profile?.uid === indicator.assigneeId || isLanhDao) && (
                        <button 
                          onClick={() => setEditingValue({ id: indicator.id, value: indicator.currentValue })}
                          className="p-1 text-blue-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Tiến độ đạt được
                  </span>
                  <span className={cn(
                    progress >= 100 ? "text-green-600" : "text-blue-600"
                  )}>{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      progress >= 100 ? "bg-green-500" : "bg-blue-500"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {assignee?.photoURL ? (
                    <img src={assignee.photoURL} className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                      <UserIcon className="w-3 h-3 text-slate-400" />
                    </div>
                  )}
                  <span className="text-xs text-slate-500 font-medium">{assignee?.displayName}</span>
                </div>
                {indicator.lastUpdatedAt && (
                  <span className="text-[10px] text-slate-400 italic">
                    Cập nhật: {indicator.lastUpdatedAt.toDate().toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredIndicators.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <Target className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400">Không tìm thấy chỉ tiêu nào</h3>
        </div>
      )}

      {isFormOpen && <IndicatorForm onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
