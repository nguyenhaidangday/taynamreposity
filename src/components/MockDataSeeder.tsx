import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../hooks/useData';
import { Task, Indicator, UserProfile, IndicatorStatus } from '../types';
import { Database, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MockDataSeeder() {
  const { users } = useData();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const seedData = async () => {
    if (users.length === 0) return;
    setLoading(true);
    
    const activeUsers = users.filter(u => u.status === 'active');
    const leader = activeUsers.find(u => u.role === 'Lãnh đạo' || u.role === 'Admin') || activeUsers[0];
    const specialist = activeUsers.find(u => u.role === 'Chuyên viên') || activeUsers[0];

    try {
      // Seed Projects
      const mockProjects = [
        {
          title: 'Chiến dịch Chuyển đổi số 2024',
          description: 'Triển khai các giải pháp công nghệ mới cho toàn bộ văn phòng.',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          status: 'Đang thực hiện',
          creatorId: leader.uid,
          createdAt: Timestamp.now(),
          phases: [
            { id: 'p1', title: 'Khảo sát nhu cầu', startDate: '2024-01-01', endDate: '2024-02-15', status: 'Hoàn thành' },
            { id: 'p2', title: 'Lựa chọn giải pháp', startDate: '2024-02-16', endDate: '2024-04-30', status: 'Đang thực hiện' },
            { id: 'p3', title: 'Triển khai thử nghiệm', startDate: '2024-05-01', endDate: '2024-08-31', status: 'Chưa thực hiện' },
            { id: 'p4', title: 'Vận hành chính thức', startDate: '2024-09-01', endDate: '2024-12-31', status: 'Chưa thực hiện' },
          ]
        },
        {
          title: 'Dự án Cải cách Hành chính',
          description: 'Tối ưu hóa quy trình làm việc và giảm thiểu giấy tờ.',
          startDate: '2024-03-01',
          endDate: '2024-06-30',
          status: 'Đang thực hiện',
          creatorId: leader.uid,
          createdAt: Timestamp.now(),
          phases: [
            { id: 'p5', title: 'Rà soát quy trình cũ', startDate: '2024-03-01', endDate: '2024-03-31', status: 'Hoàn thành' },
            { id: 'p6', title: 'Xây dựng quy trình mới', startDate: '2024-04-01', endDate: '2024-05-15', status: 'Đang thực hiện' },
            { id: 'p7', title: 'Đào tạo nhân sự', startDate: '2024-05-16', endDate: '2024-06-30', status: 'Chưa thực hiện' },
          ]
        }
      ];

      const projectIds: string[] = [];
      for (const project of mockProjects) {
        const docRef = await addDoc(collection(db, 'projects'), project);
        projectIds.push(docRef.id);
      }

      // Seed Tasks
      const mockTasks = [
        {
          title: 'Báo cáo tình hình kinh tế Q1',
          description: 'Tổng hợp số liệu từ các phòng ban để làm báo cáo quý.',
          projectId: projectIds[0],
          taskType: 'Lãnh đạo giao',
          deadline: Timestamp.fromDate(new Date(Date.now() + 86400000 * 5)),
          estimatedHours: 8,
          progress: 30,
          status: 'Đang thực hiện',
          creatorId: leader.uid,
          assigneeId: specialist.uid,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
          timeSlots: [{ date: new Date().toISOString().split('T')[0], hours: [8, 9, 10] }],
          createdAt: Timestamp.now(),
          assignedAt: Timestamp.now()
        },
        {
          title: 'Chuẩn bị tài liệu họp giao ban',
          description: 'In ấn và gửi tài liệu cho các đại biểu.',
          projectId: projectIds[1],
          taskType: 'Tự đăng ký',
          deadline: Timestamp.fromDate(new Date(Date.now() + 86400000 * 2)),
          estimatedHours: 2,
          progress: 100,
          status: 'Hoàn thành',
          creatorId: specialist.uid,
          assigneeId: specialist.uid,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          timeSlots: [{ date: new Date().toISOString().split('T')[0], hours: [14, 15] }],
          createdAt: Timestamp.now(),
          assignedAt: Timestamp.now()
        }
      ];

      for (const task of mockTasks) {
        await addDoc(collection(db, 'tasks'), task);
      }

      // Seed Indicators - 4 per field
      const fields = [
        'Y tế', 'Kinh tế', 'Tư pháp - Khen thưởng', 'Quốc phòng - Quân sự', 'Công tác Xây dựng Đảng', 
        'Thể thao', 'ANTT', 'MTTQ-đoàn thể', 'Tôn giáo', 'Xã hội', 
        'Giáo dục', 'Văn hóa', '766', 'Thông tin chung'
      ];

      const mockIndicators: Omit<Indicator, 'id'>[] = [];

      fields.forEach(field => {
        for (let i = 1; i <= 4; i++) {
          const target = Math.floor(Math.random() * 100) + 50;
          const current = Math.floor(Math.random() * target);
          const status: IndicatorStatus = Math.random() > 0.2 ? 'Đã duyệt' : 'Chờ duyệt';
          
          mockIndicators.push({
            name: `Chỉ tiêu ${field} số ${i}`,
            field,
            unit: field === 'Kinh tế' ? 'Tỷ đồng' : field === '766' ? '%' : 'Đơn vị',
            targetValue: target,
            currentValue: current,
            assigneeId: specialist.uid,
            creatorId: leader.uid,
            status,
            periodType: 'Năm',
            periodValue: '2024',
            createdAt: Timestamp.now(),
            lastUpdatedAt: Timestamp.now(),
            description: `Mô tả cho chỉ tiêu ${field} số ${i}`
          });
        }
      });

      for (const indicator of mockIndicators) {
        await addDoc(collection(db, 'indicators'), indicator);
      }

      // Seed Apps
      const mockApps = [
        { name: 'Văn phòng Đảng ủy', icon: 'Shield', url: '/portal', description: 'Ứng dụng nội bộ Văn phòng Đảng ủy', position: 0, isInternal: true },
        { name: 'Sổ tay Đảng viên', icon: 'BookOpen', url: 'https://dangcongsan.vn', description: 'Tài liệu hướng dẫn và tra cứu thông tin Đảng viên', position: 1 },
        { name: 'Hệ thống thu thập tin tức', icon: 'Search', url: 'https://example.com', description: 'Thu thập, tổng hợp thông tin trên Internet', position: 2 },
        { name: 'Trợ lý ảo', icon: 'Bot', url: 'https://example.com', description: 'Hỗ trợ giải đáp thắc mắc và văn bản AI', position: 3 },
        { name: 'Theo dõi Đại hội', icon: 'TrendingUp', url: 'https://example.com', description: 'Theo dõi tiến trình và kết quả Đại hội', position: 4 },
        { name: 'Cổng thông tin Đảng', icon: 'Globe', url: 'https://dangcongsan.vn', description: 'Cổng thông tin điện thử Đảng Cộng sản Việt Nam', position: 5 }
      ];
      
      for (const app of mockApps) {
        await addDoc(collection(db, 'apps'), { ...app, createdAt: Timestamp.now() });
      }

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      console.error("Seeding error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={seedData}
      disabled={loading || done}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl transition-all shadow-sm border",
        done ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : done ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <Database className="w-4 h-4" />
      )}
      {done ? 'Đã tạo dữ liệu' : 'Tạo dữ liệu mẫu'}
    </button>
  );
}
