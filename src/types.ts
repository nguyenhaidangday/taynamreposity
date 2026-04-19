import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Admin' | 'Chánh Văn phòng' | 'Phó Chánh Văn phòng 1' | 'Phó Chánh Văn phòng 2' | 'Chuyên viên' | 'Lãnh đạo';
export type UserStatus = 'pending' | 'active';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
}

export type TaskStatus = 'Chưa thực hiện' | 'Đang thực hiện' | 'Chờ phê duyệt' | 'Hoàn thành' | 'Quá hạn';
export type TaskType = 'Lãnh đạo giao' | 'Tự đăng ký';
export type ProgressStatus = 'Chậm tiến độ' | 'Đúng tiến độ' | 'Vượt tiến độ' | 'Chưa xác định';
export type QualityStatus = 'Chưa đánh giá' | 'Đạt' | 'Không đạt' | 'Xuất sắc';

export type IndicatorStatus = 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
export type IndicatorPeriodType = 'Năm' | 'Giai đoạn' | 'Quý';

export type ProjectStatus = 'Đang thực hiện' | 'Hoàn thành' | 'Tạm dừng';

export interface ProjectPhase {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TaskStatus;
  assigneeId?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: ProjectStatus;
  creatorId: string;
  createdAt: Timestamp;
  phases?: ProjectPhase[];
}

export interface Indicator {
  id: string;
  name: string;
  field: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  assigneeId: string;
  creatorId: string;
  status: IndicatorStatus;
  periodType: IndicatorPeriodType;
  periodValue: string;
  createdAt: Timestamp;
  lastUpdatedAt: Timestamp | null;
  description?: string;
}

export interface TimeSlot {
  date: string; // YYYY-MM-DD
  hours: number[]; // 0-23
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  taskType: TaskType;
  deadline: Timestamp;
  creatorId: string;
  assigneeId: string;
  createdAt: Timestamp;
  assignedAt: Timestamp;
  status: TaskStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeSlots: TimeSlot[];
  progressStatus?: ProgressStatus;
  qualityStatus?: QualityStatus;
  notifiedDeadline?: boolean;
}

export interface UserEvaluation {
  id: string;
  userId: string;
  period: string; // e.g., "2024-Q1" or "2024-04"
  quantityScore: number; // 0, 5, 10, 15
  timelinessScore: number; // 0, 5, 10, 15
  qualityScore: number; // 0, 10, 15, 20, 25, 30
  totalScore: number;
  rank: string;
  createdAt: Timestamp;
  details: {
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    qualityApprovedTasks: number;
  };
}

export type ScheduleStatus = 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  chairperson: string;
  attendees: string;
  location: string;
  status: ScheduleStatus;
  creatorId: string;
  creatorEmail: string;
  createdAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface ExternalApp {
  id: string;
  name: string;
  icon: string; // URL or icon name
  url: string;
  description: string;
  position: number;
  isInternal?: boolean;
  createdAt: Timestamp;
}
