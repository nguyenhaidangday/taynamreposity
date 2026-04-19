import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { X, Target, Plus, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Indicator, IndicatorStatus, IndicatorPeriodType } from '../types';
import { cn } from '../lib/utils';

interface IndicatorFormProps {
  onClose: () => void;
}

const INITIAL_FIELDS = [
  'Y tế',
  'Kinh tế',
  'Tư pháp - Khen thưởng',
  'Quốc phòng - Quân sự',
  'Công tác Xây dựng Đảng',
  'Thể thao',
  'ANTT',
  'MTTQ-đoàn thể',
  'Tôn giáo',
  'Xã hội',
  'Giáo dục',
  'Văn hóa',
  '766',
  'Thông tin chung'
];

const YEARS = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
const QUARTERS = ['1', '2', '3', '4'];

export default function IndicatorForm({ onClose }: IndicatorFormProps) {
  const { profile } = useAuth();
  const { users } = useData();
  const [name, setName] = useState('');
  const [field, setField] = useState(INITIAL_FIELDS[0]);
  const [newField, setNewField] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);
  const [unit, setUnit] = useState('');
  const [targetValue, setTargetValue] = useState<number>(0);
  const [assigneeId, setAssigneeId] = useState('');
  const [periodType, setPeriodType] = useState<IndicatorPeriodType>('Năm');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState('1');
  const [periodRange, setPeriodRange] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUsers = users.filter(u => u.status === 'active');
  const isLanhDao = profile?.role === 'Lãnh đạo' || profile?.role === 'Chánh Văn phòng' || profile?.role === 'Admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    if (!name || !unit || !assigneeId) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    setSubmitting(true);

    try {
      const finalField = isAddingField ? newField : field;
      const status: IndicatorStatus = isLanhDao ? 'Đã duyệt' : 'Chờ duyệt';

      let periodValue = '';
      if (periodType === 'Năm') periodValue = year;
      else if (periodType === 'Quý') periodValue = `Quý ${quarter}/${year}`;
      else periodValue = periodRange;

      if (periodType === 'Giai đoạn' && !periodRange) {
        setError('Vui lòng nhập giai đoạn (ví dụ: 2021-2025).');
        setSubmitting(false);
        return;
      }

      const newIndicator: Omit<Indicator, 'id'> = {
        name,
        field: finalField,
        unit,
        targetValue,
        currentValue: 0,
        assigneeId,
        creatorId: profile.uid,
        status,
        periodType,
        periodValue,
        createdAt: Timestamp.now(),
        lastUpdatedAt: null,
        description
      };

      await addDoc(collection(db, 'indicators'), newIndicator);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'indicators');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            {isLanhDao ? 'Thiết lập Chỉ tiêu mới' : 'Đăng ký Chỉ tiêu mới'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên chỉ tiêu *</label>
              <input
                required
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ví dụ: Tỷ lệ giải quyết hồ sơ đúng hạn..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lĩnh vực *</label>
                {isAddingField ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newField}
                      onChange={e => setNewField(e.target.value)}
                      className="flex-1 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Nhập lĩnh vực mới..."
                    />
                    <button 
                      type="button"
                      onClick={() => setIsAddingField(false)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={field}
                      onChange={e => setField(e.target.value)}
                      className="flex-1 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {INITIAL_FIELDS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setIsAddingField(true)}
                      className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị tính *</label>
                <input
                  required
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ví dụ: %, Hồ sơ, Tỷ đồng..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loại chỉ tiêu *</label>
                <select
                  value={periodType}
                  onChange={e => setPeriodType(e.target.value as IndicatorPeriodType)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Năm">Chỉ tiêu Năm</option>
                  <option value="Quý">Chỉ tiêu Quý</option>
                  <option value="Giai đoạn">Chỉ tiêu Giai đoạn</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian *</label>
                {periodType === 'Năm' && (
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
                {periodType === 'Quý' && (
                  <div className="flex gap-2">
                    <select
                      value={quarter}
                      onChange={e => setQuarter(e.target.value)}
                      className="flex-1 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {QUARTERS.map(q => <option key={q} value={q}>Quý {q}</option>)}
                    </select>
                    <select
                      value={year}
                      onChange={e => setYear(e.target.value)}
                      className="flex-1 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
                {periodType === 'Giai đoạn' && (
                  <input
                    type="text"
                    value={periodRange}
                    onChange={e => setPeriodRange(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ví dụ: 2021-2025"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá trị mục tiêu *</label>
                <input
                  required
                  type="number"
                  value={targetValue}
                  onChange={e => setTargetValue(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Người phụ trách *</label>
                <select
                  required
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn chuyên viên...</option>
                  {activeUsers.map(user => (
                    <option key={user.uid} value={user.uid}>{user.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả chi tiết</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                placeholder="Nhập mô tả hoặc cách tính chỉ tiêu..."
              />
            </div>
          </div>

          {!isLanhDao && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              Lưu ý: Chỉ tiêu do chuyên viên đăng ký sẽ ở trạng thái <strong>Chờ duyệt</strong>. Sau khi lãnh đạo phê duyệt, chỉ tiêu mới trở thành chính thức để cập nhật số liệu.
            </div>
          )}
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Target className="w-4 h-4" />
            )}
            {isLanhDao ? 'Thiết lập Chỉ tiêu' : 'Đăng ký Chỉ tiêu'}
          </button>
        </div>
      </div>
    </div>
  );
}
