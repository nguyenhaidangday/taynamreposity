import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

console.log('Firebase Config loaded:');
console.log('- Project ID:', firebaseConfig.projectId);
console.log('- Database ID:', firebaseConfig.firestoreDatabaseId);

if (getApps().length === 0) {
  console.log('Initializing Firebase Admin...');
  try {
    // Explicitly provide projectId from firebase-applet-config.json
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

// Initialize Firestore with the specific database ID
let db: Firestore;
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

try {
  if (databaseId) {
    console.log(`Connecting to Firestore database: ${databaseId}`);
    db = getFirestore(databaseId);
  } else {
    console.log('Connecting to default Firestore database');
    db = getFirestore();
  }
  
  // Set settings if needed, but usually not required for simple admin access
} catch (error) {
  console.error('Error in getFirestore call:', error);
  db = getFirestore(); // Fallback to default
}

// Firestore Health Check with more info
async function testFirestore() {
  try {
    console.log(`Testing Firestore connection to ${databaseId || 'default'}...`);
    // Try to get a document from the 'test' collection
    // Note: get() on document that doesn't exist should NOT throw PERMISSION_DENIED 
    // if the service account has Cloud Datastore User role.
    const testDoc = await db.collection('test').doc('connection').get();
    console.log('Firestore connection check completed. Doc exists:', testDoc.exists);
  } catch (error: any) {
    console.error('Firestore connection test FAILED!');
    console.error('- Code:', error?.code);
    console.error('- Details:', error?.details);
    console.error('- Message:', error?.message);
    if (error?.code === 7) {
      console.error('CRITICAL: PERMISSION_DENIED. The Service Account likely lacks "Cloud Datastore User" or "Firebase Admin" roles for this database.');
      console.error('Suggestion: Ensure the database exists and the Service Account has sufficient IAM permissions.');
    }
  }
}
testFirestore();

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured. Skipping email.');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"TaskFlow" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

// API to get all indicators
app.get('/api/indicators', async (req, res) => {
  try {
    const snapshot = await db.collection('indicators').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error('Error fetching indicators:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const snapshot = await db.collection('tasks').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to get schedules (optionally filter by date)
app.get('/api/schedules', async (req, res) => {
  try {
    const { date } = req.query;
    let query = db.collection('schedules');
    
    if (date) {
      query = query.where('date', '==', date) as any;
    }
    
    const snapshot = await query.get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to create schedule(s)
app.post('/api/schedules', async (req, res) => {
  try {
    const body = req.body;
    
    // Handle list of schedules
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        if (item.date && item.time && item.title) {
          const docRef = await db.collection('schedules').add({
            ...item,
            status: item.status || 'Chờ duyệt',
            createdAt: new Date(),
          });
          results.push({ id: docRef.id, title: item.title });
        }
      }
      return res.json({ status: 'ok', count: results.length, items: results });
    }

    // Handle single schedule object
    const scheduleData = body;
    if (!scheduleData.date || !scheduleData.time || !scheduleData.title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const docRef = await db.collection('schedules').add({
      ...scheduleData,
      status: scheduleData.status || 'Chờ duyệt',
      createdAt: new Date(),
    });

    res.json({ id: docRef.id, status: 'ok' });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to trigger email when task assigned
app.post('/api/notify-assignment', async (req, res) => {
  const { taskId, assigneeEmail, assigneeName, title, creatorName } = req.body;

  try {
    if (assigneeEmail) {
      const subject = `[TaskFlow] Bạn được giao công việc mới: ${title}`;
      const text = `Chào ${assigneeName || 'bạn'},\n\nBạn vừa được giao một công việc mới: "${title}" bởi ${creatorName}.\n\nHãy truy cập hệ thống để xem chi tiết và cập nhật tiến độ.\n\nTrân trọng,\nĐội ngũ TaskFlow`;
      await sendEmail(assigneeEmail, subject, text);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error in notify-assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to trigger email when task updated
app.post('/api/notify-update', async (req, res) => {
  const { taskId, creatorEmail, creatorName, title, updaterName, status, progress, suggestions } = req.body;

  try {
    if (creatorEmail) {
      const subject = `[TaskFlow] Cập nhật công việc: ${title}`;
      let text = `Chào ${creatorName || 'Sếp'},\n\nCông việc "${title}" đã được cập nhật bởi ${updaterName}.\n\n`;
      text += `- Trạng thái: ${status}\n`;
      text += `- Tiến độ: ${progress}%\n`;
      if (suggestions) {
        text += `- Kiến nghị/Đề xuất: ${suggestions}\n`;
      }
      text += `\nHãy truy cập hệ thống để xem chi tiết.\n\nTrân trọng,\nĐội ngũ TaskFlow`;
      
      await sendEmail(creatorEmail, subject, text);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error in notify-update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API to bulk notify deadlines
app.post('/api/bulk-notify-deadlines', async (req, res) => {
  const { notifications } = req.body; // Array of { email, name, title, deadline, creatorEmail, creatorName }

  try {
    for (const note of notifications) {
      if (note.email) {
        const subject = `[TaskFlow] Nhắc nhở: Công việc "${note.title}" sắp đến hạn`;
        const text = `Chào ${note.name},\n\nCông việc "${note.title}" của bạn sẽ đến hạn vào ngày mai (${note.deadline}).\n\nHãy kiểm tra và hoàn thành công việc đúng hạn.\n\nTrân trọng,\nĐội ngũ TaskFlow`;
        await sendEmail(note.email, subject, text);
      }
      
      // Notify Creator (Leader)
      if (note.creatorEmail && note.creatorEmail !== note.email) {
        const subject = `[TaskFlow] Theo dõi: Công việc "${note.title}" sắp đến hạn`;
        const text = `Chào ${note.creatorName},\n\nCông việc "${note.title}" được giao cho ${note.name} sẽ đến hạn vào ngày mai (${note.deadline}).\n\nTrân trọng,\nĐội ngũ TaskFlow`;
        await sendEmail(note.creatorEmail, subject, text);
      }
    }
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error in bulk-notify-deadlines:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Background job to check for deadlines
async function checkDeadlines() {
  console.log('Checking deadlines...');
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  
  // Start of tomorrow
  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  // End of tomorrow
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  try {
    // Simplified query to avoid index issues, filter in memory if needed
    const tasksSnapshot = await db.collection('tasks').get();

    for (const doc of tasksSnapshot.docs) {
      const task = doc.data();
      if (task.status === 'Hoàn thành' || !task.deadline) continue;

      const deadline = task.deadline.toDate();

      // If deadline is tomorrow and not yet notified
      if (deadline >= startOfTomorrow && deadline <= endOfTomorrow && !task.notifiedDeadline) {
        const userDoc = await db.collection('users').doc(task.assigneeId).get();
        const user = userDoc.data();
        
        const creatorDoc = await db.collection('users').doc(task.creatorId).get();
        const creator = creatorDoc.data();

        const subject = `[TaskFlow] Nhắc nhở: Công việc "${task.title}" sắp đến hạn`;
        const deadlineStr = deadline.toLocaleDateString('vi-VN');

        // Notify Assignee
        if (user?.email) {
          const text = `Chào ${user.displayName},\n\nCông việc "${task.title}" của bạn sẽ đến hạn vào ngày mai (${deadlineStr}).\n\nHãy kiểm tra và hoàn thành công việc đúng hạn.\n\nTrân trọng,\nĐội ngũ TaskFlow`;
          await sendEmail(user.email, subject, text);
        }

        // Notify Creator (Leader)
        if (creator?.email && task.creatorId !== task.assigneeId) {
          const text = `Chào ${creator.displayName},\n\nCông việc "${task.title}" được giao cho ${user?.displayName || 'nhân viên'} sẽ đến hạn vào ngày mai (${deadlineStr}).\n\nTrân trọng,\nĐội ngũ TaskFlow`;
          await sendEmail(creator.email, subject, text);
        }
        
        // Mark as notified
        await doc.ref.update({ notifiedDeadline: true });
      }
    }
  } catch (error: any) {
    console.error('Error checking deadlines (Background Job):');
    console.error('- Message:', error?.message);
    console.error('- Code:', error?.code);
  }
}

// Run deadline check every hour
setInterval(checkDeadlines, 3600000);
// Run once on startup
checkDeadlines();

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'build');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
