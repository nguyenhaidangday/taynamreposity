import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function clearData() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error('firebase-applet-config.json not found');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: config.projectId
    });
  } catch (e) {
    // Already initialized
  }

  const db = getFirestore(config.firestoreDatabaseId || '(default)');
  const collections = ['tasks', 'indicators', 'evaluations'];

  for (const collectionName of collections) {
    console.log(`Clearing collection: ${collectionName}`);
    try {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleared ${snapshot.size} documents from ${collectionName}`);
    } catch (error) {
      console.error(`Error clearing ${collectionName}:`, error);
    }
  }
}

clearData().catch(console.error);
