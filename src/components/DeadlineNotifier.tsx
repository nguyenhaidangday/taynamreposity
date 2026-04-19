import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { startOfTomorrow, endOfTomorrow } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';

export default function DeadlineNotifier() {
  const { profile } = useAuth();
  const { tasks, users } = useData();

  useEffect(() => {
    // Only Admin or Leaders trigger the check to avoid duplicate emails
    if (!profile || !['Admin', 'Chánh Văn phòng', 'Phó Chánh Văn phòng 1', 'Phó Chánh Văn phòng 2', 'Lãnh đạo'].includes(profile.role)) {
      return;
    }

    const checkAndNotify = async () => {
      const tomorrowStart = startOfTomorrow();
      const tomorrowEnd = endOfTomorrow();

      const tasksToNotify = tasks.filter(task => {
        if (task.status === 'Hoàn thành' || task.notifiedDeadline) return false;
        if (!task.deadline) return false;
        
        const deadline = task.deadline.toDate();
        return deadline >= tomorrowStart && deadline <= tomorrowEnd;
      });

      if (tasksToNotify.length === 0) return;

      const notifications = tasksToNotify.map(task => {
        const assignee = users.find(u => u.uid === task.assigneeId);
        const creator = users.find(u => u.uid === task.creatorId);
        const deadlineDate = task.deadline.toDate();
        return {
          taskId: task.id,
          email: assignee?.email,
          name: assignee?.displayName,
          creatorEmail: creator?.email,
          creatorName: creator?.displayName,
          title: task.title,
          deadline: deadlineDate.toLocaleDateString('vi-VN')
        };
      }).filter(n => n.email);

      if (notifications.length === 0) return;

      try {
        const response = await fetch('/api/bulk-notify-deadlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifications }),
        });

        if (response.ok) {
          // Mark tasks as notified in Firestore
          for (const task of tasksToNotify) {
            await updateDoc(doc(db, 'tasks', task.id), {
              notifiedDeadline: true
            });
          }
          console.log(`Sent ${notifications.length} deadline reminders.`);
        }
      } catch (error) {
        console.error('Failed to send deadline reminders:', error);
      }
    };

    // Check once when component mounts (and data is ready)
    if (tasks.length > 0 && users.length > 0) {
      checkAndNotify();
    }
  }, [profile, tasks, users]);

  return null; // This component doesn't render anything
}
