import admin from 'firebase-admin';

const REQUIRE_FIREBASE_AUTH = process.env.REQUIRE_FIREBASE_AUTH === '1';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'talk2me-e90b1';

let adminApp;

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  return admin.credential.applicationDefault();
}

export function getAdminApp() {
  if (!adminApp) {
    adminApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: getCredential(),
          projectId: FIREBASE_PROJECT_ID,
        });
  }
  return adminApp;
}

export function getAuth() {
  return getAdminApp().auth();
}

export function getFirestore() {
  return getAdminApp().firestore();
}

export function getBearerToken(req) {
  const url = new URL(req.url, 'http://localhost');
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function authenticateWebSocketRequest(req) {
  const token = getBearerToken(req);
  if (!token && !REQUIRE_FIREBASE_AUTH) {
    return { uid: null, anonymous: true };
  }
  if (!token) {
    throw new Error('Missing Firebase ID token.');
  }

  const decoded = await getAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email || null,
    anonymous: false,
  };
}

export { REQUIRE_FIREBASE_AUTH, FIREBASE_PROJECT_ID };
