import admin, { ServiceAccount } from 'firebase-admin'
import serviceAccount from '../../gcp-creds.json'

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
      databaseURL: "https://kippa-ai-jobs-default-rtdb.firebaseio.com"
    })
  } catch (error) {
    console.log('Firebase admin initialization error', (error as any).stack)
  }
}
export default admin.database()