import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, Timestamp, updateDoc, where, orderBy } from 'firebase/firestore'
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

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
	const cleaned: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined) cleaned[key] = value
	}
	return cleaned as T
}

export async function addWithMeta<T extends Record<string, unknown>>(path: string, data: T) {
	const uid = requireUid()
    const ref = collection(db, path)
	const payload = {
		...stripUndefined(data),
		ownerUid: uid,
		createdAt: nowTimestamp(),
		updatedAt: nowTimestamp(),
	}
	const res = await addDoc(ref, payload)
	return { id: res.id, ...payload } as T & { id: string }
}

export async function updateWithMeta<T extends Record<string, unknown>>(path: string, id: string, data: Partial<T>) {
    const ref = doc(db, path, id)
	await updateDoc(ref, { ...stripUndefined(data as Record<string, unknown>), updatedAt: nowTimestamp() })
}

export async function listByOwner<T>(path: string): Promise<Array<T & { id: string }>> {
	const uid = requireUid()
    const ref = collection(db, path)
	const q = query(ref, where('ownerUid', '==', uid))
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function deleteById(path: string, id: string): Promise<void> {
	const ref = doc(db, path, id)
	await deleteDoc(ref)
}

export async function existsWhere(path: string, field: string, value: string): Promise<boolean> {
	const uid = requireUid()
	const ref = collection(db, path)
	const q = query(ref, where('ownerUid', '==', uid), where(field, '==', value), limit(1))
	const snap = await getDocs(q)
	return !snap.empty
}

export async function listWhere<T>(path: string, field: string, value: string): Promise<Array<T & { id: string }>> {
	const uid = requireUid()
	const ref = collection(db, path)
	const q = query(ref, where('ownerUid', '==', uid), where(field, '==', value))
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listByOwnerBetween<T>(path: string, dateField: string, start: Date, end: Date): Promise<Array<T & { id: string }>> {
	const uid = requireUid()
	const ref = collection(db, path)
	const q = query(
		ref,
		where('ownerUid', '==', uid),
		where(dateField, '>=', start),
		where(dateField, '<=', end),
		orderBy(dateField, 'asc'),
	)
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}


