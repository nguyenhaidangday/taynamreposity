import { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Users, LogOut, Plus, Bell, Search, Menu, X, Target, User as UserIcon, Trophy, Briefcase, Home, Grid, CalendarDays } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { cn } from '../lib/utils';
import TaskForm from './TaskForm';
// ChatBot removed on user request

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { tasks, indicators } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { label: 'Cổng ứng dụng', icon: Home, path: '/' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/portal' },
    { label: 'Lịch làm việc', icon: CalendarDays, path: '/schedules' },
    { label: 'Công việc và Thời gian', icon: ListTodo, path: '/tasks' },
    { label: 'Chỉ tiêu', icon: Target, path: '/indicators' },
    { label: 'Nhiệm vụ lớn', icon: Briefcase, path: '/projects' },
    { label: 'Đánh giá', icon: Trophy, path: '/evaluation' },
    { label: 'Cá nhân', icon: UserIcon, path: '/profile' },
    ...(profile?.role === 'Admin' ? [
      { label: 'Người dùng', icon: Users, path: '/users' },
      { label: 'Quản lý Ứng dụng', icon: Grid, path: '/apps' }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50 fixed inset-y-0 left-0 md:relative",
        isSidebarOpen ? "translate-x-0 w-64 shadow-2xl md:shadow-none" : "-translate-x-full w-64 md:translate-x-0 md:w-20"
      )}>
        <div className="p-6 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-200">
              <span className="text-white font-bold text-sm">VP</span>
            </div>
            {(isSidebarOpen || !isSidebarOpen) && <span className={cn("font-bold text-base text-slate-800 transition-opacity whitespace-nowrap", !isSidebarOpen && "hidden md:hidden")}>Văn phòng Đảng ủy</span>}
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all group",
                location.pathname === item.path 
                  ? "bg-blue-50 text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
            {isSidebarOpen && <span className="font-medium">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsTaskFormOpen(true)}
              className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-4 h-4" />
              Tạo việc mới
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-800">{profile?.displayName || 'Chưa đặt tên'}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">{profile?.role}</div>
              </div>
              {profile?.photoURL ? (
                <img src={profile.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-md" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-md">
                  <span className="text-blue-600 font-bold">{profile?.displayName?.[0] || '?'}</span>
                </div>
              )}
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40">
          {navItems.filter(i => ['/', '/portal', '/tasks', '/indicators', '/profile'].includes(i.path)).map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                location.pathname === item.path ? "text-blue-600" : "text-slate-400"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </main>

      {/* Floating Action Button for Mobile */}
      <button 
        onClick={() => setIsTaskFormOpen(true)}
        className="md:hidden fixed bottom-20 right-4 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 z-40 active:scale-90 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {isTaskFormOpen && <TaskForm onClose={() => setIsTaskFormOpen(false)} />}
    </div>
  );
}
