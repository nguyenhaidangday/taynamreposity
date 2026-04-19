import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { collection, addDoc, Timestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { Task, TaskStatus } from '../types';
import { Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { parse, isValid, format } from 'date-fns';

interface PendingTask {
  id: string;
  title: string;
  description: string;
  assigneeName: string;
  matchedAssigneeId?: string;
  matchedAssigneeDisplayName?: string;
  deadlineStr: string;
  assignedDateStr: string;
  statusStr: string;
  progressStr: string;
  taskType: 'Lãnh đạo giao' | 'Tự đăng ký';
  isDuplicate: boolean;
  existingTaskId?: string;
  action: 'import' | 'skip' | 'rename' | 'update';
  newName?: string;
}

export default function TaskImport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { users, tasks } = useData();
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Advanced header detection: find the row with the most keyword matches
      let headerIdx = -1;
      let maxMatches = 0;
      const headerKeywords = [
        'nhiệm vụ', 'công việc', 'nội dung', 'người thực hiện', 
        'hoàn thành', 'trạng thái', 'tình trạng', 'hạn', 'deadline',
        'nguồn gốc', 'đơn vị', 'cấp giao', 'chủ trì', 'phối hợp'
      ];

      for (let i = 0; i < Math.min(data.length, 50); i++) { // Scan up to 50 rows
        const row = data[i];
        if (row && Array.isArray(row)) {
          let matches = 0;
          row.forEach(cell => {
            const cellStr = String(cell || '').trim().toLowerCase();
            if (headerKeywords.some(k => cellStr.includes(k))) {
              matches++;
            }
          });
          
          // If this row has more matches than previous best
          if (matches > maxMatches && matches >= 2) { // Require at least 2 matches to be a header
            maxMatches = matches;
            headerIdx = i;
          }
        }
      }

      if (headerIdx === -1) {
        setError('Không tìm thấy hàng tiêu đề phù hợp trong file Excel. Vui lòng kiểm tra lại các cột "Tên nhiệm vụ", "Người thực hiện"...');
        return;
      }

      const headers = data[headerIdx].map(h => String(h || '').trim().toLowerCase());
      const findCol = (keywords: string[]) => {
        // Try exact match first
        const exactIdx = headers.findIndex(h => keywords.some(k => h === k.toLowerCase()));
        if (exactIdx !== -1) return exactIdx;
        // Then try partial match
        return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
      };

      const colMap = {
        title: findCol(['tên nhiệm vụ', 'nhiệm vụ', 'nội dung công việc', 'nội dung', 'tên công việc', 'nhiệm vụ chủ trì', 'danh mục công việc']),
        assignee: findCol(['đầu mối thực hiện', 'người thực hiện', 'người thực hiện chính', 'người chủ trì', 'nhân sự', 'chủ trì thực hiện']),
        deadline: findCol(['ngày hoàn thành', 'hạn hoàn thành', 'deadline', 'thời hạn', 'hạn chót', 'ngày hết hạn']),
        assignedAt: findCol(['ngày thực hiện', 'ngày giao', 'ngày được giao', 'ngày giao việc']),
        status: findCol(['trạng thái', 'tình trạng', 'kết quả', 'tiến độ']),
        progress: findCol(['mức độ', 'tiến độ thực hiện', 'đánh giá tiến độ']),
        source: findCol(['loại nhiệm vụ', 'nguồn gốc', 'nguồn gốc nhiệm vụ', 'phân loại']),
        unit: findCol(['đơn vị chủ trì thực hiện', 'đơn vị chủ trì', 'đơn vị thực hiện', 'đơn vị', 'phòng ban']),
        leader: findCol(['lđvp chủ trì', 'lãnh đạo chủ trì', 'lãnh đạo giao'])
      };

      if (colMap.title === -1) {
        setError('Không tìm thấy cột chứa "Tên nhiệm vụ" hoặc "Nội dung công việc".');
        return;
      }

      const imported: PendingTask[] = [];
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row[colMap.title]) continue;

        const title = String(row[colMap.title]).trim();
        const assigneeName = String(row[colMap.assignee] || '').trim();
        const deadlineStr = String(row[colMap.deadline] || '').trim();
        const assignedDateStr = String(row[colMap.assignedAt] !== -1 ? row[colMap.assignedAt] : '').trim();
        const statusStr = String(row[colMap.status] || '').trim();
        const progressStr = String(row[colMap.progress] || '').trim();
        const sourceStr = String(row[colMap.source] || '').trim();
        const unitStr = String(row[colMap.unit] || '').trim();
        const leaderStr = String(row[colMap.leader] || '').trim();

        const existingTask = tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
        const isDuplicate = !!existingTask;

        // Find assignee from system users based on Họ và tên (displayName) - Strict match preferred
        const matchedUser = users.find(u => {
          const sysName = (u.displayName || '').trim().toLowerCase();
          const excelName = assigneeName.trim().toLowerCase();
          return sysName === excelName;
        }) || users.find(u => {
          const sysName = (u.displayName || '').trim().toLowerCase();
          const excelName = assigneeName.trim().toLowerCase();
          return sysName.includes(excelName) || excelName.includes(sysName);
        });

        // Specialist logic: default to skip if not their name
        const isSelf = matchedUser?.uid === profile.uid;
        const isSpecialist = profile.role === 'Chuyên viên';
        let defaultAction: 'import' | 'skip' | 'rename' | 'update' = isDuplicate ? 'update' : 'import';
        
        if (isSpecialist && !isSelf) {
          defaultAction = 'skip';
        }

        imported.push({
          id: Math.random().toString(36).substr(2, 9),
          title,
          description: `Đơn vị chủ trì: ${unitStr}\nLãnh đạo chủ trì: ${leaderStr}`,
          assigneeName,
          matchedAssigneeId: matchedUser?.uid,
          matchedAssigneeDisplayName: matchedUser?.displayName,
          deadlineStr,
          assignedDateStr,
          statusStr,
          progressStr,
          taskType: (sourceStr.includes('Lãnh đạo') || leaderStr) ? 'Lãnh đạo giao' : 'Tự đăng ký',
          isDuplicate,
          existingTaskId: existingTask?.id,
          action: defaultAction
        });
      }

      setPendingTasks(imported);
      setStep('review');
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!profile) return;
    setImporting(true);

    try {
      for (const pt of pendingTasks) {
        if (pt.action === 'skip') continue;

        // Map status
        let status: TaskStatus = 'Chưa thực hiện';
        const s = pt.statusStr.toLowerCase();
        if (s.includes('hoàn thành') || s.includes('xong') || s.includes('đã xong')) status = 'Hoàn thành';
        else if (s.includes('đang') || s.includes('thực hiện')) status = 'Đang thực hiện';
        else if (s.includes('chờ') || s.includes('phê duyệt')) status = 'Chờ phê duyệt';

        // Map progressStatus
        let progressStatus: any = 'Chưa xác định';
        const p = pt.progressStr.toLowerCase();
        if (p.includes('chậm')) progressStatus = 'Chậm tiến độ';
        else if (p.includes('đúng')) progressStatus = 'Đúng tiến độ';
        else if (p.includes('vượt')) progressStatus = 'Vượt tiến độ';

        // Default qualityStatus based on progressStatus
        let qualityStatus: any = 'Chưa đánh giá';
        if (status === 'Hoàn thành') {
          if (progressStatus === 'Đúng tiến độ' || progressStatus === 'Vượt tiến độ') {
            qualityStatus = 'Đạt';
          } else if (progressStatus === 'Chậm tiến độ') {
            qualityStatus = 'Không đạt';
          }
        }

        if (pt.action === 'update' && pt.existingTaskId) {
          // Update existing task
          await updateDoc(doc(db, 'tasks', pt.existingTaskId), {
            status,
            progressStatus,
            qualityStatus,
            lastImportedAt: Timestamp.now()
          });
          continue;
        }

        const finalTitle = pt.action === 'rename' ? (pt.newName || pt.title) : pt.title;
        
        // Use pre-matched assignee or fallback to current user
        const assigneeId = pt.matchedAssigneeId || profile.uid;

        // Parse deadline
        let deadline = Timestamp.now();
        let assignedAt = Timestamp.now();
        const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
        
        for (const f of formats) {
          const d = parse(pt.deadlineStr, f, new Date());
          if (isValid(d)) {
            deadline = Timestamp.fromDate(d);
            break;
          }
        }

        for (const f of formats) {
          const d = parse(pt.assignedDateStr, f, new Date());
          if (isValid(d)) {
            assignedAt = Timestamp.fromDate(d);
            break;
          }
        }

        await addDoc(collection(db, 'tasks'), {
          title: finalTitle,
          description: pt.description,
          status,
          progressStatus,
          qualityStatus,
          taskType: pt.taskType,
          creatorId: profile.uid,
          assigneeId,
          deadline,
          assignedAt,
          startDate: format(assignedAt.toDate(), 'yyyy-MM-dd'),
          endDate: format(deadline.toDate(), 'yyyy-MM-dd'),
          createdAt: Timestamp.now(),
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nhập công việc từ Excel</h2>
              <p className="text-sm text-slate-500">Tự động tạo danh sách nhiệm vụ từ file báo cáo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold mb-1">Lỗi phân tích file</p>
                <p>{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="mt-2 text-xs font-bold underline hover:no-underline"
                >
                  Thử lại
                </button>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {step === 'upload' ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-green-500 hover:bg-green-50 transition-all cursor-pointer group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Chọn file Excel báo cáo</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Hệ thống sẽ tự động phân tích các cột Tên nhiệm vụ, Người thực hiện, Ngày hoàn thành...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm text-amber-800 font-medium">
                    Phát hiện {pendingTasks.filter(t => t.isDuplicate).length} công việc trùng tên. Vui lòng kiểm tra lại.
                  </span>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="p-4 font-semibold">Tên nhiệm vụ</th>
                      <th className="p-4 font-semibold">Người thực hiện</th>
                      <th className="p-4 font-semibold">Hạn</th>
                      <th className="p-4 font-semibold">Trạng thái / Mức độ</th>
                      <th className="p-4 font-semibold">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pendingTasks.map((pt, idx) => (
                      <tr key={pt.id} className={cn("text-sm", pt.isDuplicate && pt.action !== 'rename' ? "bg-red-50/30" : "")}>
                        <td className="p-4">
                          {pt.action === 'rename' ? (
                            <input 
                              type="text" 
                              value={pt.newName || pt.title}
                              onChange={e => {
                                const newTasks = [...pendingTasks];
                                newTasks[idx].newName = e.target.value;
                                setPendingTasks(newTasks);
                              }}
                              className="w-full p-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          ) : (
                            <div>
                              <div className="font-medium text-slate-800">{pt.title}</div>
                              {pt.isDuplicate && (
                                <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                                  <AlertCircle className="w-3 h-3" /> Trùng tên trong hệ thống
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-slate-600">{pt.assigneeName}</div>
                          {pt.matchedAssigneeDisplayName ? (
                            <div className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3 h-3" /> Khớp: {pt.matchedAssigneeDisplayName}
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" /> Không tìm thấy user
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-slate-600">{pt.deadlineStr}</td>
                        <td className="p-4">
                          <div className="text-slate-600">{pt.statusStr}</div>
                          {pt.progressStr && (
                            <div className="text-[10px] text-blue-500 font-medium mt-1 uppercase">
                              {pt.progressStr}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <select 
                            value={pt.action}
                            onChange={e => {
                              const newTasks = [...pendingTasks];
                              newTasks[idx].action = e.target.value as any;
                              if (e.target.value === 'rename' && !newTasks[idx].newName) {
                                newTasks[idx].newName = pt.title + ' (Copy)';
                              }
                              setPendingTasks(newTasks);
                            }}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                          >
                            {pt.isDuplicate && <option value="update">Cập nhật (Mặc định)</option>}
                            <option value="import">Nhập mới</option>
                            <option value="rename">Đổi tên & Nhập mới</option>
                            <option value="skip">Bỏ qua</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium"
          >
            Hủy
          </button>
          {step === 'review' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-8 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-100 font-bold flex items-center gap-2"
            >
              {importing ? 'Đang nhập...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Xác nhận nhập ({pendingTasks.filter(t => t.action !== 'skip').length})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
