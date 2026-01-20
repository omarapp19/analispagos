import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const initializeFirebase = async () => {
  try {
    // Intenta cargar las credenciales desde un archivo local si existe
    // NOTA: En producción, esto debería manejarse con variables de entorno
    let serviceAccount;
    try {
        const data = await readFile(new URL('./serviceAccountKey.json', import.meta.url));
        serviceAccount = JSON.parse(data);
    } catch (e) {
        console.warn('No se encontró serviceAccountKey.json local. Intentando usar variables de entorno o credenciales por defecto de Google Cloud.');
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp(); // Usa GOOGLE_APPLICATION_CREDENTIALS
    }

    console.log('Firebase Admin inicializado correctamente');
    return admin.firestore();
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    process.exit(1);
  }
};

const db = await initializeFirebase();

export { db, admin };
