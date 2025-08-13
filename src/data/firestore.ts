import { addDoc, collection, doc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../modules/firebase'

export function requireUid(): string {
	const uid = auth.currentUser?.uid
	if (!uid) throw new Error('Not authenticated')
	return uid
}

export function nowTimestamp() {
	return serverTimestamp()
}

export function toDate(value: unknown): Date | null {
	if (!value) return null
	if (value instanceof Date) return value
	if (value instanceof Timestamp) return value.toDate()
	return null
}

export async function addWithMeta<T extends Record<string, unknown>>(path: string, data: T) {
	const uid = requireUid()
    const ref = collection(db, path)
	const payload = {
		...data,
		ownerUid: uid,
		createdAt: nowTimestamp(),
		updatedAt: nowTimestamp(),
	}
	const res = await addDoc(ref, payload)
	return { id: res.id, ...payload } as T & { id: string }
}

export async function updateWithMeta<T extends Record<string, unknown>>(path: string, id: string, data: Partial<T>) {
    const ref = doc(db, path, id)
	await updateDoc(ref, { ...data, updatedAt: nowTimestamp() })
}

export async function listByOwner<T>(path: string): Promise<Array<T & { id: string }>> {
	const uid = requireUid()
    const ref = collection(db, path)
	const q = query(ref, where('ownerUid', '==', uid))
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}


