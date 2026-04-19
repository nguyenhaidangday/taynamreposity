import { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { Project, Task, ProjectPhase, TaskStatus } from '../types';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { Plus, Calendar, Layout, ChevronRight, Briefcase, Clock, CheckCircle2, AlertCircle, Trash2, Edit2, X, User as UserIcon } from 'lucide-react';
import GanttChart from './GanttChart';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function ProjectManagement() {
  const { projects, tasks, users, loading } = useData();
  const { profile } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  const handleOpenForm = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setPhases(project.phases || []);
    } else {
      setEditingProject(null);
      setPhases([{
        id: crypto.randomUUID(),
        title: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'Chưa thực hiện'
      }]);
    }
    setShowForm(true);
  };

  const handleAddPhase = () => {
    setPhases([...phases, {
      id: crypto.randomUUID(),
      title: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'Chưa thực hiện'
    }]);
  };

  const handleRemovePhase = (id: string) => {
    setPhases(phases.filter(p => p.id !== id));
  };

  const handlePhaseChange = (id: string, field: keyof ProjectPhase, value: string) => {
    setPhases(phases.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    const formData = new FormData(e.currentTarget);
    
    const projectData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      status: 'Đang thực hiện',
      creatorId: profile.uid,
      createdAt: editingProject ? editingProject.createdAt : Timestamp.now(),
      phases: phases.filter(p => p.title.trim() !== '')
    };

    try {
      if (editingProject) {
        await updateDoc(doc(db, 'projects', editingProject.id), projectData);
      } else {
        await addDoc(collection(db, 'projects'), projectData);
      }
      setShowForm(false);
      setEditingProject(null);
      setPhases([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      if (selectedProjectId === id) setSelectedProjectId(null);
      setDeletingProjectId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quản lý Nhiệm vụ lớn</h1>
          <p className="text-xs sm:text-sm text-slate-500">Theo dõi tiến độ và sơ đồ Gantt cho các dự án trọng điểm</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 text-sm"
        >
          <Plus className="w-5 h-5" />
          Thêm nhiệm vụ lớn
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500">Đang tải dữ liệu nhiệm vụ lớn...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Project List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                Danh sách nhiệm vụ
              </h2>
            </div>
            <div className="divide-y divide-slate-50 max-h-[300px] lg:max-h-[600px] overflow-y-auto">
              {projects.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm italic">Chưa có nhiệm vụ nào</div>
              ) : (
                projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-all hover:bg-slate-50 group",
                      selectedProjectId === project.id ? "bg-blue-50/50 border-l-4 border-blue-500" : "border-l-4 border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={cn(
                        "text-sm font-bold line-clamp-2",
                        selectedProjectId === project.id ? "text-blue-700" : "text-slate-700"
                      )}>
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {deletingProjectId === project.id ? (
                          <div className="flex items-center gap-1 bg-white shadow-sm rounded-lg p-1 border border-red-100">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id);
                              }}
                              className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              Xóa
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProjectId(null);
                              }}
                              className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenForm(project);
                              }}
                              className="p-1 hover:bg-white rounded text-slate-400 hover:text-blue-500"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProjectId(project.id);
                              }}
                              className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(project.startDate), 'dd/MM/yy')} - {format(new Date(project.endDate), 'dd/MM/yy')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Gantt Chart & Details */}
        <div className="lg:col-span-3 space-y-6">
          {selectedProject ? (
            <>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedProject.title}</h2>
                    <p className="text-slate-500 text-sm mt-1">{selectedProject.description}</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase",
                    selectedProject.status === 'Đang thực hiện' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                  )}>
                    {selectedProject.status}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between sm:block">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Giai đoạn</div>
                    <div className="text-lg sm:text-2xl font-bold text-slate-700">{selectedProject.phases?.length || 0}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex justify-between sm:block">
                    <div className="text-[10px] text-green-600 uppercase font-bold mb-1">Hoàn thành</div>
                    <div className="text-lg sm:text-2xl font-bold text-green-700">
                      {selectedProject.phases?.filter(p => p.status === 'Hoàn thành').length || 0}
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between sm:block">
                    <div className="text-[10px] text-blue-600 uppercase font-bold mb-1">Thời gian</div>
                    <div className="text-sm font-bold text-blue-700">
                      {format(new Date(selectedProject.startDate), 'dd/MM')} - {format(new Date(selectedProject.endDate), 'dd/MM/yy')}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Layout className="w-4 h-4 text-blue-500" />
                      Sơ đồ Gantt
                    </h3>
                  </div>
                  {selectedProject.phases && selectedProject.phases.length > 0 ? (
                    <GanttChart project={selectedProject} phases={selectedProject.phases} />
                  ) : (
                    <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Chưa có giai đoạn nào được định nghĩa cho nhiệm vụ này.</p>
                      <p className="text-slate-400 text-[10px] mt-1">Hãy chỉnh sửa nhiệm vụ lớn để thêm các giai đoạn.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase List for Project */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700">Danh sách các giai đoạn</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] text-slate-400 uppercase font-bold bg-slate-50/50">
                        <th className="p-4">Tên giai đoạn</th>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedProject.phases?.map(phase => (
                        <tr key={phase.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="text-sm font-bold text-slate-700">{phase.title}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-[10px] text-slate-500">
                              {format(new Date(phase.startDate), 'dd/MM/yyyy')} - {format(new Date(phase.endDate), 'dd/MM/yyyy')}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase",
                              phase.status === 'Hoàn thành' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {phase.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Chọn một nhiệm vụ lớn</h2>
              <p className="text-slate-500 max-w-sm mt-2">
                Hãy chọn một nhiệm vụ lớn từ danh sách bên trái để xem chi tiết tiến độ và sơ đồ Gantt.
              </p>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingProject ? 'Cập nhật Nhiệm vụ lớn' : 'Thêm Nhiệm vụ lớn mới'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên nhiệm vụ lớn</label>
                    <input
                      name="title"
                      required
                      defaultValue={editingProject?.title}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Nhập tên nhiệm vụ lớn..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mô tả</label>
                    <textarea
                      name="description"
                      rows={3}
                      defaultValue={editingProject?.description}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Mô tả chi tiết..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày bắt đầu</label>
                      <input
                        name="startDate"
                        type="date"
                        required
                        defaultValue={editingProject?.startDate}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày kết thúc</label>
                      <input
                        name="endDate"
                        type="date"
                        required
                        defaultValue={editingProject?.endDate}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Các giai đoạn (Phases)</label>
                    <button
                      type="button"
                      onClick={handleAddPhase}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Thêm giai đoạn
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {phases.map((phase, index) => (
                      <div key={phase.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative group">
                        <button
                          type="button"
                          onClick={() => handleRemovePhase(phase.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="space-y-2">
                          <input
                            value={phase.title}
                            onChange={(e) => handlePhaseChange(phase.id, 'title', e.target.value)}
                            placeholder={`Tên giai đoạn ${index + 1}...`}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={phase.startDate}
                              onChange={(e) => handlePhaseChange(phase.id, 'startDate', e.target.value)}
                              className="p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                            />
                            <input
                              type="date"
                              value={phase.endDate}
                              onChange={(e) => handlePhaseChange(phase.id, 'endDate', e.target.value)}
                              className="p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                            />
                          </div>
                          <select
                            value={phase.status}
                            onChange={(e) => handlePhaseChange(phase.id, 'status', e.target.value as TaskStatus)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                          >
                            <option value="Chưa thực hiện">Chưa thực hiện</option>
                            <option value="Đang thực hiện">Đang thực hiện</option>
                            <option value="Hoàn thành">Hoàn thành</option>
                            <option value="Quá hạn">Quá hạn</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  {editingProject ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
