import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Shield, CheckCircle, XCircle, User as UserIcon, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useData } from '../hooks/useData';
import { UserRole, UserStatus } from '../types';
import { cn } from '../lib/utils';

const ROLES: UserRole[] = ['Lãnh đạo', 'Chánh Văn phòng', 'Phó Chánh Văn phòng 1', 'Phó Chánh Văn phòng 2', 'Chuyên viên', 'Admin'];

export default function UserManagement() {
  const { users } = useData();
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<{ uid: string, name: string } | null>(null);
  const [deletingUserUid, setDeletingUserUid] = useState<string | null>(null);

  const handleDeleteUser = async (uid: string) => {
    setUpdating(uid);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setDeletingUserUid(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateName = async (uid: string) => {
    if (!editingName || !editingName.name.trim()) return;
    setUpdating(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { displayName: editingName.name.trim() });
      setEditingName(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdating(null);
    }
  };
  const handleUpdateRole = async (uid: string, role: UserRole) => {
    setUpdating(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateStatus = async (uid: string, status: UserStatus) => {
    setUpdating(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <Shield className="w-6 h-6 text-indigo-600" />
          Quản lý Người dùng & Phân quyền
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-100">
                <th className="pb-4 font-semibold text-slate-500 uppercase text-xs tracking-wider">Người dùng</th>
                <th className="pb-4 font-semibold text-slate-500 uppercase text-xs tracking-wider">Vai trò</th>
                <th className="pb-4 font-semibold text-slate-500 uppercase text-xs tracking-wider">Trạng thái</th>
                <th className="pb-4 font-semibold text-slate-500 uppercase text-xs tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(user => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        {editingName?.uid === user.uid ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingName.name}
                              onChange={e => setEditingName({ ...editingName, name: e.target.value })}
                              className="p-1 border border-indigo-300 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateName(user.uid)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingName(null)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <div className="font-semibold text-slate-800">{user.displayName || 'Chưa đặt tên'}</div>
                            <button
                              onClick={() => setEditingName({ uid: user.uid, name: user.displayName || '' })}
                              className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-all"
                            >
                              <UserIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <select
                      value={user.role}
                      onChange={e => handleUpdateRole(user.uid, e.target.value as UserRole)}
                      disabled={updating === user.uid}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      user.status === 'active' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {user.status === 'active' ? 'Đã kích hoạt' : 'Đang chờ'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      {deletingUserUid === user.uid ? (
                        <div className="flex items-center gap-1 bg-slate-50 border border-red-100 rounded-lg p-1">
                          <button
                            onClick={() => handleDeleteUser(user.uid)}
                            disabled={updating === user.uid}
                            className="px-2 py-1 bg-red-600 text-white rounded text-[10px] hover:bg-red-700 font-medium"
                          >
                            Xác nhận
                          </button>
                          <button
                            onClick={() => setDeletingUserUid(null)}
                            className="px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded text-[10px] hover:bg-slate-50 font-medium"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          {user.status === 'pending' ? (
                            <button
                              onClick={() => handleUpdateStatus(user.uid, 'active')}
                              disabled={updating === user.uid}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-all shadow-sm"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Kích hoạt
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(user.uid, 'pending')}
                              disabled={updating === user.uid}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 transition-all"
                            >
                              <XCircle className="w-3 h-3" />
                              Tạm dừng
                            </button>
                          )}
                          <button
                            onClick={() => setDeletingUserUid(user.uid)}
                            disabled={updating === user.uid}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa người dùng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
