import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { ExternalApp } from '../types';
import { cn } from '../lib/utils';
import { LogOut, UserCircle, CalendarDays, Clock, MapPin, Globe, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Timestamp } from 'firebase/firestore';

import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';

const DefaultAppIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  return <LucideIcons.Globe className={className} />;
};

export default function LandingPage() {
  const { user, profile } = useAuth();
  const { externalApps, schedules, loading } = useData();
  const navigate = useNavigate();

  const today = new Date();
  const [viewDate, setViewDate] = useState(format(today, 'yyyy-MM-dd'));

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Define the default system app
  const internalPortal: ExternalApp = {
    id: 'internal-portal',
    name: 'Văn phòng Đảng ủy',
    icon: 'Shield',
    url: '/portal',
    description: 'Ứng dụng nội bộ Văn phòng Đảng ủy',
    position: -1,
    isInternal: true,
    createdAt: Timestamp.now()
  };

  // Combine default app with loaded apps, filtering out duplicates if any
  const allApps = [
    internalPortal,
    ...externalApps.filter(app => !app.isInternal)
  ].sort((a, b) => (a.position || 0) - (b.position || 0));

  const handleAppClick = (app: ExternalApp) => {
    if (app.isInternal) {
      navigate('/portal');
    } else {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center py-4 px-4 overflow-x-hidden">
      {/* Top Header */}
      <div className="max-w-6xl w-full flex justify-end mb-8">
        <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-2 pr-4 rounded-2xl border border-white/50 shadow-sm">
          <div className="flex items-center gap-3">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <UserCircle className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-700">{profile?.displayName || user?.email}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">{profile?.role}</div>
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl w-full text-center mb-16 px-4">
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 tracking-tight uppercase">
          Cổng thông tin và Ứng dụng Đảng ủy phường Tây Nam
        </h1>
        <div className="h-1.5 w-24 bg-red-600 mx-auto rounded-full mb-6" />
        <p className="text-slate-500 max-w-2xl mx-auto font-medium">
          Cổng thông tin tập trung kết nối các ứng dụng nghiệp vụ, điều hành và quản trị số của cơ quan Đảng.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12 max-w-6xl w-full">
        {allApps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app)}
            className="group flex flex-col items-center gap-4 transition-all"
          >
            <div className={cn(
              "w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white shadow-sm border border-slate-100 flex items-center justify-center transition-all duration-300",
              "group-hover:shadow-xl group-hover:border-red-100 group-hover:-translate-y-2 group-active:scale-95",
              app.isInternal ? "bg-red-50/20 border-red-100 shadow-[0_8px_30px_rgb(185,28,28,0.06)] ring-2 ring-red-50" : ""
            )}>
              {app.icon.startsWith('http') ? (
                <img src={app.icon} alt={app.name} className="w-10 h-10 md:w-12 md:h-12 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <DefaultAppIcon name={app.icon} className={cn("w-10 h-10 md:w-12 md:h-12", app.isInternal ? "text-red-600" : "text-slate-600 group-hover:text-red-500")} />
              )}
            </div>
            <div className="flex flex-col items-center text-center gap-1 px-2">
              <span className={cn(
                "text-sm font-bold text-slate-700 leading-tight transition-colors group-hover:text-red-700",
                app.isInternal ? "text-slate-900" : ""
              )}>
                {app.name}
              </span>
              {app.description && (
                <span className="text-[10px] text-slate-400 font-medium line-clamp-2 max-w-[150px]">
                  {app.description}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Weekly Schedule Section - Now focused on a single day as requested */}
      <div className="mt-24 max-w-4xl w-full px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-red-600" />
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Lịch công tác ngày</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Chi tiết lịch làm việc cơ quan</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-100 p-1">
              <button 
                onClick={() => setViewDate(format(addDays(parseISO(viewDate), -1), 'yyyy-MM-dd'))}
                className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-all"
              >
                <LucideIcons.ChevronLeft className="w-5 h-5" />
              </button>
              <input 
                type="date" 
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 px-2"
              />
              <button 
                onClick={() => setViewDate(format(addDays(parseISO(viewDate), 1), 'yyyy-MM-dd'))}
                className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-all"
              >
                <LucideIcons.ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {!isSameDay(parseISO(viewDate), today) && (
              <button 
                onClick={() => setViewDate(format(today, 'yyyy-MM-dd'))}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                Hôm nay
              </button>
            )}

            <button 
              onClick={() => navigate('/schedules')}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Đăng ký lịch
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {schedules.filter(s => s.date === viewDate && s.status === 'Đã duyệt').length > 0 ? (
            schedules
              .filter(s => s.date === viewDate && s.status === 'Đã duyệt')
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(item => (
                <div key={item.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-red-200 transition-all group">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-32 flex flex-col md:items-center justify-center border-b md:border-b-0 md:border-r border-slate-50 pb-4 md:pb-0 md:pr-6">
                      <div className="flex items-center gap-2 text-red-600 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xl font-black">{item.time}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Giờ bắt đầu</span>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight group-hover:text-red-700 transition-colors">
                          {item.title}
                        </h3>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 text-slate-500">
                            <MapPin className="w-4 h-4 text-slate-300" />
                            <span className="text-xs font-medium">{item.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Chủ trì</div>
                          <div className="text-sm text-slate-700 font-semibold">{item.chairperson}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tham dự</div>
                          <div className="text-sm text-slate-600 line-clamp-2">{item.attendees}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-slate-200" />
              </div>
              <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm">Chưa có lịch công tác</h3>
              <p className="text-slate-300 text-xs mt-1">Ngày {format(parseISO(viewDate), 'dd/MM/yyyy')} hiện chưa có lịch nào được duyệt.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-20 text-slate-400 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
        <div className="w-8 h-px bg-slate-200" />
        Bản quyền thuộc Văn phòng Đảng ủy Tây Nam
        <div className="w-8 h-px bg-slate-200" />
      </div>
    </div>
  );
}
