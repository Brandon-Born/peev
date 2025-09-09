import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, Timestamp, updateDoc, where, orderBy, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../modules/firebase'
import { User } from '../domain/models'

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

// NEW: Team-based version for PEEV
export async function addWithTeamMeta<T extends Record<string, unknown>>(path: string, data: T, teamId: string) {
    const ref = collection(db, path)
	const payload = {
		...stripUndefined(data),
		teamId: teamId,
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

// NEW: Team-based query functions for PEEV
export async function listByTeam<T>(path: string, teamId: string): Promise<Array<T & { id: string }>> {
    const ref = collection(db, path)
	const q = query(ref, where('teamId', '==', teamId))
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listTeamWhere<T>(path: string, field: string, value: string, teamId: string): Promise<Array<T & { id: string }>> {
	const ref = collection(db, path)
	const q = query(ref, where('teamId', '==', teamId), where(field, '==', value))
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function existsTeamWhere(path: string, field: string, value: string, teamId: string): Promise<boolean> {
	const ref = collection(db, path)
	const q = query(ref, where('teamId', '==', teamId), where(field, '==', value), limit(1))
	const snap = await getDocs(q)
	return !snap.empty
}

export async function listTeamBetween<T>(path: string, dateField: string, start: Date, end: Date, teamId: string): Promise<Array<T & { id: string }>> {
	const ref = collection(db, path)
	const q = query(
		ref,
		where('teamId', '==', teamId),
		where(dateField, '>=', start),
		where(dateField, '<=', end),
		orderBy(dateField, 'asc'),
	)
	const snap = await getDocs(q)
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

// NEW: Team and user management functions
export async function createTeam(name: string): Promise<{ id: string; name: string; ownerUid: string; members: string[] }> {
	const uid = requireUid()
	const ref = collection(db, 'teams')
	const payload = {
		name: name,
		ownerUid: uid,
		members: [uid], // Creator is automatically a member
		createdAt: nowTimestamp(),
		updatedAt: nowTimestamp(),
	}
	const res = await addDoc(ref, payload)
	return { id: res.id, ...payload } as { id: string; name: string; ownerUid: string; members: string[] }
}

export async function createUserProfile(teamId?: string | null, teamName?: string | null): Promise<void> {
	const uid = requireUid()
	const user = auth.currentUser
	if (!user) throw new Error('No authenticated user')
	
	const ref = doc(db, 'users', uid)
	const payload: any = {
		displayName: user.displayName || '',
		email: user.email || '',
		createdAt: nowTimestamp(),
		updatedAt: nowTimestamp(),
	}
	
	// Only add team info if provided
	if (teamId && teamName) {
		payload.teamId = teamId
		payload.teamName = teamName
	}
	
	// Use setDoc since we want to use the UID as the document ID
	await setDoc(ref, payload)
}

export async function getUserProfile(uid?: string): Promise<(User & { id: string }) | null> {
	const userId = uid || requireUid()
	const ref = doc(db, 'users', userId)
	const snap = await getDoc(ref)
	if (!snap.exists()) return null
	return { id: snap.id, ...snap.data() } as User & { id: string }
}

// Team member management functions
export async function getTeamDetails(teamId: string): Promise<{ team: any; members: Array<User & { id: string }> } | null> {
	try {
		// Get team document
		const teamRef = doc(db, 'teams', teamId)
		const teamSnap = await getDoc(teamRef)
		
		if (!teamSnap.exists()) {
			return null
		}
		
		const teamData = teamSnap.data()
		const memberIds = teamData.members || []
		
		// Get all member profiles
		const members: Array<User & { id: string }> = []
		for (const memberId of memberIds) {
			const memberProfile = await getUserProfile(memberId)
			if (memberProfile) {
				members.push(memberProfile)
			}
		}
		
		return {
			team: { id: teamSnap.id, ...teamData },
			members
		}
	} catch (error) {
		console.error('Error getting team details:', error)
		return null
	}
}

export async function inviteTeamMember(email: string): Promise<{ success: boolean; message: string }> {
	try {
		const uid = requireUid()
		
		// Get current user's profile to find their team
		const userProfile = await getUserProfile(uid)
		if (!userProfile?.teamId) {
			return { success: false, message: 'You are not assigned to a team' }
		}
		
		// Get team details to verify ownership
		const teamRef = doc(db, 'teams', userProfile.teamId)
		const teamSnap = await getDoc(teamRef)
		
		if (!teamSnap.exists()) {
			return { success: false, message: 'Team not found' }
		}
		
		const teamData = teamSnap.data()
		
		// All team members have admin privileges - verify user is a team member
		const existingMembers = teamData.members || []
		if (!existingMembers.includes(uid)) {
			return { success: false, message: 'You must be a team member to invite new members' }
		}
		
		// Find user by email
		const usersQuery = query(collection(db, 'users'), where('email', '==', email))
		const usersSnap = await getDocs(usersQuery)
		
		if (usersSnap.empty) {
			return { success: false, message: 'No user found with this email address. They need to sign up for PEEV first.' }
		}
		
		const targetUser = usersSnap.docs[0]
		const targetUserId = targetUser.id
		const targetUserData = targetUser.data()
		
		// Check if user is already a member
		if (existingMembers.includes(targetUserId)) {
			return { success: false, message: 'This user is already a member of your team' }
		}
		
		// Check if user is already in another team
		if (targetUserData.teamId && targetUserData.teamId !== userProfile.teamId) {
			return { success: false, message: 'This user is already a member of another team' }
		}
		
		// Add user to team members array
		const updatedMembers = [...existingMembers, targetUserId]
		
		// Update team document
		await updateDoc(teamRef, {
			members: updatedMembers,
			updatedAt: nowTimestamp()
		})
		
		// Update user's profile with team information
		const userRef = doc(db, 'users', targetUserId)
		await updateDoc(userRef, {
			teamId: userProfile.teamId,
			teamName: teamData.name,
			updatedAt: nowTimestamp()
		})
		
		return { 
			success: true, 
			message: `Successfully added ${targetUserData.displayName || email} to your team!` 
		}
		
	} catch (error: any) {
		console.error('Error inviting team member:', error)
		return { 
			success: false, 
			message: `Failed to invite member: ${error.message}` 
		}
	}
}

export async function removeTeamMember(memberId: string): Promise<{ success: boolean; message: string }> {
	try {
		const uid = requireUid()
		
		// Get current user's profile to find their team
		const userProfile = await getUserProfile(uid)
		if (!userProfile?.teamId) {
			return { success: false, message: 'You are not assigned to a team' }
		}
		
		// Get team details to verify ownership
		const teamRef = doc(db, 'teams', userProfile.teamId)
		const teamSnap = await getDoc(teamRef)
		
		if (!teamSnap.exists()) {
			return { success: false, message: 'Team not found' }
		}
		
		const teamData = teamSnap.data()
		
		// All team members have admin privileges - verify user is a team member
		const existingMembers = teamData.members || []
		if (!existingMembers.includes(uid)) {
			return { success: false, message: 'You must be a team member to remove members' }
		}
		
		// Can't remove yourself
		if (memberId === uid) {
			return { success: false, message: 'You cannot remove yourself from the team' }
		}
		
		// Can't remove the team owner
		if (memberId === teamData.ownerUid) {
			return { success: false, message: 'The team owner cannot be removed' }
		}
		
		// Check if user is actually a member
		if (!existingMembers.includes(memberId)) {
			return { success: false, message: 'User is not a member of this team' }
		}
		
		// Remove user from team members array
		const updatedMembers = existingMembers.filter((id: string) => id !== memberId)
		
		// Update team document
		await updateDoc(teamRef, {
			members: updatedMembers,
			updatedAt: nowTimestamp()
		})
		
		// Clear user's team information
		const userRef = doc(db, 'users', memberId)
		await updateDoc(userRef, {
			teamId: null,
			teamName: null,
			updatedAt: nowTimestamp()
		})
		
		return { 
			success: true, 
			message: 'Team member removed successfully' 
		}
		
	} catch (error: any) {
		console.error('Error removing team member:', error)
		return { 
			success: false, 
			message: `Failed to remove member: ${error.message}` 
		}
	}
}


