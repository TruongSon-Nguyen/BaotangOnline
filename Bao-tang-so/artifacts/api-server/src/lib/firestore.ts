import { applicationDefault, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

const projectId = process.env.FIREBASE_PROJECT_ID || "baotangonline12345";
const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});

export const db = getFirestore(app);

export const collections = {
  accounts: "userAccounts",
  accountEmailIndex: "accountEmailIndex",
  artifacts: "artifacts",
  artifactExhibitions: "artifactExhibitions",
  artifactImages: "artifactImages",
  authSessions: "authSessions",
  exhibitions: "exhibitions",
  historicalPeriods: "historicalPeriods",
  imageHotspots: "imageHotspots",
  materials: "materials",
  museumAdmins: "museumAdmins",
  museumIntro: "museumIntro",
} as const;

export type FirestoreEntity = DocumentData & { id: string };

function normalizeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]),
    );
  }
  return value;
}

function documentData<T extends FirestoreEntity>(
  document: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): T {
  return {
    ...(normalizeValue(document.data() ?? {}) as DocumentData),
    id: document.id,
  } as T;
}

export async function getAll<T extends FirestoreEntity>(
  collection: string,
): Promise<T[]> {
  const snapshot = await db.collection(collection).get();
  return snapshot.docs.map((document) => documentData<T>(document));
}

export async function getById<T extends FirestoreEntity>(
  collection: string,
  id: string,
): Promise<T | undefined> {
  const document = await db.collection(collection).doc(id).get();
  if (!document.exists) return undefined;
  return documentData<T>(document);
}

export async function findByField<T extends FirestoreEntity>(
  collection: string,
  field: string,
  value: unknown,
): Promise<T | undefined> {
  const snapshot = await db.collection(collection).where(field, "==", value).limit(1).get();
  const document = snapshot.docs[0];
  return document ? documentData<T>(document) : undefined;
}

export function newId(): string {
  return randomUUID();
}

export function now(): Date {
  return new Date();
}

export async function createRecord<T extends Record<string, unknown>>(
  collection: string,
  values: T,
): Promise<T & { id: string }> {
  const id = newId();
  const record = { ...values, id };
  await db.collection(collection).doc(id).create(record);
  return record;
}

export async function updateRecord<T extends FirestoreEntity>(
  collection: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<T | undefined> {
  const reference = db.collection(collection).doc(id);
  const existing = await reference.get();
  if (!existing.exists) return undefined;
  if (Object.keys(updates).length === 0) return documentData<T>(existing);
  await reference.update(updates);
  return {
    ...documentData<T>(existing),
    ...updates,
  };
}

export async function deleteRecord(
  collection: string,
  id: string,
): Promise<boolean> {
  const reference = db.collection(collection).doc(id);
  const existing = await reference.get();
  if (!existing.exists) return false;
  await reference.delete();
  return true;
}

export async function deleteByField(
  collection: string,
  field: string,
  value: unknown,
): Promise<void> {
  const snapshot = await db.collection(collection).where(field, "==", value).get();
  if (snapshot.empty) return;
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    for (const document of snapshot.docs.slice(offset, offset + 400)) {
      batch.delete(document.ref);
    }
    await batch.commit();
  }
}
