import { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Task, UserProfile, Indicator, Project, ExternalApp, Schedule } from '../types';
import { useAuth } from './useAuth';

export const useData = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [externalApps, setExternalApps] = useState<ExternalApp[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Use a ref to track the number of active listeners to avoid race conditions
  const activeListeners = useRef<number>(0);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setUsers([]);
      setIndicators([]);
      setProjects([]);
      setExternalApps([]);
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let loadedCount = 0;
    const totalListeners = 6;

    const checkLoading = () => {
      loadedCount++;
      if (loadedCount >= totalListeners) {
        setLoading(false);
      }
    };

    console.log("Setting up Firestore listeners...");

    const tasksQuery = query(collection(db, 'tasks'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      tasksData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setTasks(tasksData);
      checkLoading();
    }, (error) => {
      console.error("Error loading tasks:", error);
      checkLoading();
    });

    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      checkLoading();
    }, (error) => {
      console.error("Error loading users:", error);
      checkLoading();
    });

    const indicatorsQuery = query(collection(db, 'indicators'));
    const unsubscribeIndicators = onSnapshot(indicatorsQuery, (snapshot) => {
      const indicatorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Indicator));
      indicatorsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setIndicators(indicatorsData);
      checkLoading();
    }, (error) => {
      console.error("Error loading indicators:", error);
      checkLoading();
    });

    const projectsQuery = query(collection(db, 'projects'));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      projectsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setProjects(projectsData);
      checkLoading();
    }, (error) => {
      console.error("Error loading projects:", error);
      checkLoading();
    });
    
    const appsQuery = query(collection(db, 'apps'));
    const unsubscribeApps = onSnapshot(appsQuery, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExternalApp));
      appsData.sort((a, b) => (a.position || 0) - (b.position || 0));
      setExternalApps(appsData);
      checkLoading();
    }, (error) => {
      console.error("Error loading apps:", error);
      checkLoading();
    });

    const schedulesQuery = query(collection(db, 'schedules'));
    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
      schedulesData.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateA - dateB;
      });
      setSchedules(schedulesData);
      checkLoading();
    }, (error) => {
      console.error("Error loading schedules:", error);
      checkLoading();
    });

    return () => {
      console.log("Cleaning up Firestore listeners...");
      unsubscribeTasks();
      unsubscribeUsers();
      unsubscribeIndicators();
      unsubscribeProjects();
      unsubscribeApps();
      unsubscribeSchedules();
    };
  }, [user]);

  return { tasks, users, indicators, projects, externalApps, schedules, loading };
};
