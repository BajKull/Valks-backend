import * as fbadmin from "firebase-admin";

const config = {
  type: process.env.FB_TYPE,
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key: process.env.FB_PRIVATE_KEY,
  client_email: process.env.FB_CLIENT_EMAIL,
  client_id: process.env.FB_CLIENT_ID,
  auth_uri: process.env.FB_AUTH_URI,
  token_uri: process.env.FB_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FB_AUTH_PROVIDER_CERT_URI,
  client_x509_cert_url: process.env.FB_CLIENT_CERT_URI,
} as fbadmin.ServiceAccount;

const app = fbadmin.initializeApp({
  credential: fbadmin.credential.cert(config),
  storageBucket: `${process.env.FB_PROJECT_ID}.appspot.com`,
});

const firestore = app.firestore();
const storage = app.storage().bucket();
const admin = fbadmin;

export { firestore, admin, storage };
