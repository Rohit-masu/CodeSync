import { UserRole, RoomPermission } from "../types/auth"
import { RoomModel } from "../models/Room"
import { MessageModel } from "../models/Message"
import { FileNodeModel } from "../models/FileNode"

interface RoomState {
	hostSocketId: string
	permissions: Map<string, UserRole>
	createdAt: Date
}

export interface UserMetrics {
	username: string
	filesCreated: number
	filesEditedIds: Set<string>
	linesAdded: number
	linesDeleted: number
	totalEditTime: number
	lastActivityAt: Date
}

class RoomStore {
	private rooms: Map<string, RoomState> = new Map()
	private userRoles: Map<string, Map<string, UserRole>> = new Map() // roomId -> username -> role
	private socketIdToUsername: Map<string, Map<string, string>> = new Map() // roomId -> socketId -> username
	private userMetrics: Map<string, Map<string, UserMetrics>> = new Map() // roomId -> username -> metrics
	private fileLinesCache: Map<string, Map<string, number>> = new Map() // roomId -> fileId -> lineCount

	// ── Join / leave ──────────────────────────────────────────────────────────

	async addUserToRoom(
		roomId: string,
		socketId: string,
		username: string,
		avatar: string | null = null
	): Promise<UserRole> {
		if (!this.rooms.has(roomId)) {
			const permissions = new Map<string, UserRole>()
			permissions.set(socketId, UserRole.HOST)
			this.rooms.set(roomId, {
				hostSocketId: socketId,
				permissions,
				createdAt: new Date(),
			})
			
			// Store role for rejoin
			if (!this.userRoles.has(roomId)) {
				this.userRoles.set(roomId, new Map())
			}
			this.userRoles.get(roomId)!.set(username, UserRole.HOST)
			
			// Store socketId->username mapping
			if (!this.socketIdToUsername.has(roomId)) {
				this.socketIdToUsername.set(roomId, new Map())
			}
			this.socketIdToUsername.get(roomId)!.set(socketId, username)
			
			await this._persistRoom(roomId, socketId, username, UserRole.HOST, avatar)
			return UserRole.HOST
		}

		const room = this.rooms.get(roomId)!
		
		// Check if user had a previous role
		let role: UserRole
		const roomUserRoles = this.userRoles.get(roomId)
		if (roomUserRoles && roomUserRoles.has(username)) {
			role = roomUserRoles.get(username)!
		} else {
			role = UserRole.VIEWER
		}
		
		room.permissions.set(socketId, role)
		
		// Store role for rejoin
		if (!this.userRoles.has(roomId)) {
			this.userRoles.set(roomId, new Map())
		}
		this.userRoles.get(roomId)!.set(username, role)
		
		// Store socketId->username mapping
		if (!this.socketIdToUsername.has(roomId)) {
			this.socketIdToUsername.set(roomId, new Map())
		}
		this.socketIdToUsername.get(roomId)!.set(socketId, username)
		
		await this._persistMember(roomId, socketId, username, role, avatar)
		return role
	}

	async removeUserFromRoom(
		roomId: string,
		socketId: string
	): Promise<string | null> {
		const room = this.rooms.get(roomId)
		if (!room) return null

		room.permissions.delete(socketId)

		// Clean up socketId->username mapping
		const socketIdToUsername = this.socketIdToUsername.get(roomId)
		if (socketIdToUsername) {
			socketIdToUsername.delete(socketId)
		}

		if (room.permissions.size === 0) {
			// Add delay before cleanup to prevent immediate deletion during rejoin
			setTimeout(async () => {
				const currentRoom = this.rooms.get(roomId)
				if (currentRoom && currentRoom.permissions.size === 0) {
					this.rooms.delete(roomId)
					this.socketIdToUsername.delete(roomId)
					this.userRoles.delete(roomId)
					
					// Backend Cleanup: Delete room and associated files from DB when inactive
					try {
						await RoomModel.deleteOne({ roomId })
						await FileNodeModel.deleteMany({ roomId })
						await MessageModel.deleteMany({ roomId })
						console.log(`[CLEANUP] Room ${roomId} inactive. Deleted room, files, and messages.`)
					} catch (err) {
						console.error(`[CLEANUP ERROR] Failed to clean up room ${roomId}:`, err)
					}
				}
			}, 30000) // Wait 30 seconds before cleanup
			
			return null
		}

		// FIX: .next().value is string | undefined — guard before using as string
		if (room.hostSocketId === socketId) {
			const nextEntry = room.permissions.keys().next()
			if (nextEntry.done || nextEntry.value == null) return null

			const newHostSocketId: string = nextEntry.value
			room.permissions.set(newHostSocketId, UserRole.HOST)
			room.hostSocketId = newHostSocketId

			// Update userRoles map for new host and downgrade old host
			const newHostUsername = this.socketIdToUsername.get(roomId)?.get(newHostSocketId)
			if (newHostUsername) {
				this.userRoles.get(roomId)?.set(newHostUsername, UserRole.HOST)
			}
			const oldHostUsername = this.socketIdToUsername.get(roomId)?.get(socketId)
			if (oldHostUsername) {
				this.userRoles.get(roomId)?.set(oldHostUsername, UserRole.EDITOR)
			}

			await RoomModel.findOneAndUpdate(
			{ roomId },
			{
				$set: {
					hostSocketId: newHostSocketId,
					"members.$[elem].role": UserRole.HOST,
				},
				$pull: { members: { socketId } },
			},
			{ arrayFilters: [{ "elem.socketId": newHostSocketId }] }
		)

			return newHostSocketId
		}

		await RoomModel.findOneAndUpdate(
			{ roomId },
			{ $pull: { members: { socketId } } }
		)
		return null
	}

	hasUserRole(roomId: string, username: string): boolean {
		const roomUserRoles = this.userRoles.get(roomId)
		return roomUserRoles ? roomUserRoles.has(username) : false
	}

	removeUserRole(roomId: string, username: string): void {
		const roomUserRoles = this.userRoles.get(roomId)
		if (roomUserRoles) {
			roomUserRoles.delete(username)
		}
	}

	getUserRole(roomId: string, socketId: string): UserRole | null {
		return this.rooms.get(roomId)?.permissions.get(socketId) ?? null
	}

	canWrite(roomId: string, socketId: string): boolean {
		const role = this.getUserRole(roomId, socketId)
		return role === UserRole.HOST || role === UserRole.EDITOR
	}

	roomExists(roomId: string): boolean {
		return this.rooms.has(roomId)
	}

	getHostSocketId(roomId: string): string | null {
		return this.rooms.get(roomId)?.hostSocketId ?? null
	}

	getRoomPermissions(roomId: string): RoomPermission[] {
		const room = this.rooms.get(roomId)
		if (!room) return []
		
		const socketIdToUsername = this.socketIdToUsername.get(roomId)
		return Array.from(room.permissions.entries()).map(([socketId, role]) => ({
			socketId,
			username: socketIdToUsername?.get(socketId) || "Unknown",
			role,
		}))
	}

	// ── Analytics ─────────────────────────────────────────────────────────────

	private initUserMetrics(roomId: string, username: string) {
		if (!this.userMetrics.has(roomId)) {
			this.userMetrics.set(roomId, new Map())
		}
		const roomMetrics = this.userMetrics.get(roomId)!
		if (!roomMetrics.has(username)) {
			roomMetrics.set(username, {
				username,
				filesCreated: 0,
				filesEditedIds: new Set(),
				linesAdded: 0,
				linesDeleted: 0,
				totalEditTime: 0,
				lastActivityAt: new Date()
			})
		}
		if (!this.fileLinesCache.has(roomId)) {
			this.fileLinesCache.set(roomId, new Map())
		}
	}

	async updateMetrics(roomId: string, username: string, event: "FILE_CREATED" | "FILE_UPDATED" | "FILE_DELETED", data?: any) {
		this.initUserMetrics(roomId, username)
		const metrics = this.userMetrics.get(roomId)!.get(username)!
		const roomFileLines = this.fileLinesCache.get(roomId)!
		
		const now = new Date()
		const timeDiff = now.getTime() - metrics.lastActivityAt.getTime()
		// Only count as active edit time if they were active in the last 5 minutes
		if (timeDiff < 5 * 60 * 1000) {
			metrics.totalEditTime += timeDiff
		} else {
			// Just a baseline for a single action after a long break
			metrics.totalEditTime += 10 * 1000 // 10 seconds 
		}
		metrics.lastActivityAt = now

		if (event === "FILE_CREATED") {
			metrics.filesCreated++
			if (data?.fileId && data?.content !== undefined) {
				roomFileLines.set(data.fileId, data.content.split('\n').length)
			}
		}
		if (event === "FILE_UPDATED" && data?.fileId) {
			metrics.filesEditedIds.add(data.fileId)
			if (data?.newContent !== undefined) {
				const newLines = data.newContent.split('\n').length
				const oldLines = roomFileLines.get(data.fileId)
				
				// If we have seen this file before, calculate diff
				if (oldLines !== undefined) {
					const diff = newLines - oldLines
					if (diff > 0) metrics.linesAdded += diff
					else if (diff < 0) metrics.linesDeleted += Math.abs(diff)
				} else {
					// Fallback if not seen, but shouldn't happen unless joined mid-session without full sync
					roomFileLines.set(data.fileId, newLines)
				}
				
				// Update cache for next time
				roomFileLines.set(data.fileId, newLines)
			}
		}
		if (event === "FILE_DELETED" && data?.fileId) {
			const lines = roomFileLines.get(data.fileId)
			if (lines !== undefined) {
				metrics.linesDeleted += lines
				roomFileLines.delete(data.fileId)
			}
		}
	}

	async getAnalytics(roomId: string) {
		const metricsMap = this.userMetrics.get(roomId)
		// Transform to expected frontend format
		const users = metricsMap ? Array.from(metricsMap.values()).map(u => ({
			username: u.username,
			filesCreated: u.filesCreated,
			filesEdited: u.filesEditedIds.size,
			linesAdded: u.linesAdded,
			linesDeleted: u.linesDeleted,
			totalEditTime: u.totalEditTime,
			lastActivityAt: u.lastActivityAt
		})) : []

		// Calculate project estimate
		const fileTree = await this.getFileTree(roomId)
		let totalLOC = 0
		let fileCount = 0
		let maxNestedLevel = 0

		fileTree.forEach(node => {
			if (node.type === 'file') {
				fileCount++
				totalLOC += (node.content || "").split('\n').length
			}
		})

		const room = this.rooms.get(roomId)
		const hoursSinceCreation = room ? (Date.now() - room.createdAt.getTime()) / (1000 * 60 * 60) : 1
		const effectiveHours = Math.max(hoursSinceCreation, 0.5) // minimum 30 mins

		let totalLinesAdded = 0
		users.forEach(u => totalLinesAdded += u.linesAdded)

		const avgVelocity = totalLinesAdded > 0 ? (totalLinesAdded / effectiveHours) : 50 // default 50 loc/hr
		const complexityFactor = 0.8 + (fileCount / 100)
		
		const estimationHours = (totalLOC / avgVelocity) * complexityFactor

		return {
			users,
			projectEstimate: {
				totalLOC,
				fileCount,
				avgVelocity: Math.round(avgVelocity),
				complexityFactor: complexityFactor.toFixed(2),
				estimationHours: Math.round(estimationHours * 10) / 10
			}
		}
	}

	// ── Role management ───────────────────────────────────────────────────────

	async setUserRole(
		roomId: string,
		requesterSocketId: string,
		targetSocketId: string,
		newRole: UserRole
	): Promise<{ success: boolean; error?: string }> {
		const room = this.rooms.get(roomId)
		if (!room) return { success: false, error: "Room not found" }

		if (room.permissions.get(requesterSocketId) !== UserRole.HOST)
			return { success: false, error: "Only the host can change permissions" }
		if (targetSocketId === requesterSocketId)
			return { success: false, error: "Host cannot change their own role" }
		if (!room.permissions.has(targetSocketId))
			return { success: false, error: "Target user not found in room" }
		if (newRole === UserRole.HOST)
			return { success: false, error: "Use transferHost to assign host role" }

		room.permissions.set(targetSocketId, newRole)

		// Update userRoles map
		const username = await this.getUsernameBySocketId(roomId, targetSocketId)
		if (username) {
			const roomUserRoles = this.userRoles.get(roomId)
			if (roomUserRoles) {
				roomUserRoles.set(username, newRole)
			}
		}

		await RoomModel.findOneAndUpdate(
			{ roomId, "members.socketId": targetSocketId },
			{ $set: { "members.$.role": newRole } }
		)

		return { success: true }
	}

	async transferHost(
		roomId: string,
		currentHostSocketId: string,
		newHostSocketId: string
	): Promise<{ success: boolean; error?: string }> {
		const room = this.rooms.get(roomId)
		if (!room) return { success: false, error: "Room not found" }

		if (room.hostSocketId !== currentHostSocketId)
			return { success: false, error: "Only the host can transfer host role" }
		if (!room.permissions.has(newHostSocketId))
			return { success: false, error: "Target user not in room" }

		room.permissions.set(currentHostSocketId, UserRole.EDITOR)
		room.permissions.set(newHostSocketId, UserRole.HOST)
		room.hostSocketId = newHostSocketId

		// Update userRoles map
		const currentUsername = await this.getUsernameBySocketId(roomId, currentHostSocketId)
		const newUsername = await this.getUsernameBySocketId(roomId, newHostSocketId)
		const roomUserRoles = this.userRoles.get(roomId)
		if (roomUserRoles) {
			if (currentUsername) {
				roomUserRoles.set(currentUsername, UserRole.EDITOR)
			}
			if (newUsername) {
				roomUserRoles.set(newUsername, UserRole.HOST)
			}
		}

		await RoomModel.findOneAndUpdate(
			{ roomId },
			{
				hostSocketId: newHostSocketId,
				$set: {
					"members.$[old].role": UserRole.EDITOR,
					"members.$[neu].role": UserRole.HOST,
				},
			},
			{
				arrayFilters: [
					{ "old.socketId": currentHostSocketId },
					{ "neu.socketId": newHostSocketId },
				],
			}
		)

		return { success: true }
	}

	// ── DB persistence helpers ────────────────────────────────────────────────

	private async _persistRoom(
		roomId: string,
		hostSocketId: string,
		hostUsername: string,
		role: UserRole,
		avatar: string | null = null
	): Promise<void> {
		try {
			await RoomModel.findOneAndUpdate(
				{ roomId },
				{
					$setOnInsert: {
						roomId,
						hostSocketId,
						hostUsername,
						createdAt: new Date(),
					},
					$set: {
						isActive: true,
						lastActivityAt: new Date(),
					},
					$addToSet: {
						members: {
							username: hostUsername,
							socketId: hostSocketId,
							role: role as string,
							avatar,
							joinedAt: new Date(),
						},
					},
				},
				{ upsert: true, new: true }
			)
		} catch (err) {
			console.error("RoomStore._persistRoom error:", err)
		}
	}

	private async _persistMember(
		roomId: string,
		socketId: string,
		username: string,
		role: UserRole,
		avatar: string | null = null
	): Promise<void> {
		try {
			// First try to update existing member by username
			const updateResult = await RoomModel.updateOne(
				{ roomId, "members.username": username },
				{ 
					$set: { 
						"members.$.socketId": socketId,
						"members.$.role": role as string,
						"members.$.avatar": avatar,
						"members.$.joinedAt": new Date(),
						lastActivityAt: new Date()
					}
				}
			)

			// If no existing member found, add new one
			if (updateResult.matchedCount === 0) {
				await RoomModel.updateOne(
					{ roomId },
					{
						$push: {
							members: {
								username,
								socketId,
								role: role as string,
								avatar,
								joinedAt: new Date(),
							},
						},
						$set: { lastActivityAt: new Date() }
					}
				)
			}
		} catch (err) {
			console.error("RoomStore._persistMember error:", err)
		}
	}

	// Message persistence
	async saveMessage(
		roomId: string,
		username: string,
		socketId: string,
		content: string,
		type: "text" | "system" | "code" = "text"
	): Promise<void> {
		try {
			// Validate content before saving
			if (!content || content.trim() === "") {
				console.warn("RoomStore.saveMessage: content is empty or undefined, skipping")
				return
			}
			await MessageModel.create({ roomId, username, socketId, content, type })
		} catch (err) {
			console.error("RoomStore.saveMessage error:", err)
		}
	}

	async getRecentMessages(
		roomId: string,
		limit = 50
	): Promise<{ username: string; content: string; type: string; timestamp: Date }[]> {
		try {
			const messages = await MessageModel.find({ roomId })
				.sort({ timestamp: -1 })
				.limit(limit)
				.lean()
			return messages.reverse().map((m) => ({
				username: (m.username ?? "") as string,
				content: (m.content ?? "") as string,
				type: (m.type ?? "text") as string,
				timestamp: (m.timestamp ?? new Date()) as Date,
			}))
		} catch (err) {
			console.error("RoomStore.getRecentMessages error:", err)
			return []
		}
	}

	// File-node persistence
	async upsertFileNode(
		roomId: string,
		nodeId: string,
		data: {
			name?: string
			type?: "file" | "directory"
			parentId?: string | null
			content?: string
			language?: string
			lastEditedBy?: string
		},
		retryCount = 0
	): Promise<void> {
		try {
			// Generate unique nodeId if it's the initial file
			const uniqueNodeId = nodeId === 'initial-file-id' 
				? `${roomId}-initial-file-${Date.now()}` 
				: nodeId
			
			await FileNodeModel.findOneAndUpdate(
				{ roomId, nodeId: uniqueNodeId },
				{ $set: { ...data, lastEditedAt: new Date() } },
				{ upsert: true, new: true }
			)
		} catch (err: any) {
			// Catch MongoDB duplicate key error (E11000) which can happen with concurrent upserts
			if (err.code === 11000 && retryCount < 3) {
				console.warn(`RoomStore.upsertFileNode concurrent upsert conflict for ${nodeId}, retrying...`)
				await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1)))
				return this.upsertFileNode(roomId, nodeId, data, retryCount + 1)
			}
			console.error("RoomStore.upsertFileNode error:", err)
		}
	}

	async deleteFileNode(roomId: string, nodeId: string): Promise<void> {
		try {
			await FileNodeModel.deleteOne({ roomId, nodeId })
		} catch (err) {
			console.error("RoomStore.deleteFileNode error:", err)
		}
	}

	async getFileTree(roomId: string): Promise<
		{
			nodeId: string
			name: string
			type: string
			parentId: string | null
			content: string
			language: string
		}[]
	> {
		try {
			const nodes = await FileNodeModel.find({ roomId }).lean()
			return nodes.map((n) => ({
				nodeId: n.nodeId as string,
				name: n.name as string,
				type: n.type as string,
				parentId: (n.parentId ?? null) as string | null,
				content: (n.content ?? "") as string,
				language: (n.language ?? "plaintext") as string,
			}))
		} catch (err) {
			console.error("RoomStore.getFileTree error:", err)
			return []
		}
	}

	async getUserSocketIdByUsername(roomId: string, username: string): Promise<string | null> {
		try {
			const room = await RoomModel.findOne({ roomId, isActive: true })
			if (!room) return null
			
			const member = room.members.find(m => m.username === username)
			return member?.socketId || null
		} catch (err) {
			console.error("RoomStore.getUserSocketIdByUsername error:", err)
			return null
		}
	}

	async getUsernameBySocketId(roomId: string, socketId: string): Promise<string | null> {
		try {
			const room = await RoomModel.findOne({ roomId, isActive: true })
			if (!room) return null
			
			const member = room.members.find(m => m.socketId === socketId)
			return member?.username || null
		} catch (err) {
			console.error("RoomStore.getUsernameBySocketId error:", err)
			return null
		}
	}

	async getFullRoomState(roomId: string, userSocketMap?: any[]): Promise<{
		users: Array<{ socketId: string; username: string; role: string; avatar: string | null; status: string; cursorPosition: number; typing: boolean; currentFile: string | null }>
		fileTree: Array<{ nodeId: string; name: string; type: string; parentId: string | null; content: string; language: string }>
		recentMessages: Array<{ username: string; content: string; type: string; timestamp: Date }>
	}> {
		try {
			const room = this.rooms.get(roomId)
			if (!room) {
				return {
					users: [],
					fileTree: [],
					recentMessages: []
				}
			}

			// Build users array from in-memory permissions (authoritative state)
			const socketIdToUsername = this.socketIdToUsername.get(roomId)
			const roomDoc = await RoomModel.findOne({ roomId })
			const members = roomDoc?.members || []
			
			const users = Array.from(room.permissions.entries()).map(([socketId, role]) => {
				const username = socketIdToUsername?.get(socketId) || "Unknown"
				const member = members.find(m => m.socketId === socketId)
				const ephemeralUser = userSocketMap?.find(u => u.socketId === socketId)
				return {
					socketId,
					username,
					role: role as string,
					avatar: member?.avatar || null,
					status: ephemeralUser?.status || "offline",
					cursorPosition: ephemeralUser?.cursorPosition || 0,
					typing: ephemeralUser?.typing || false,
					currentFile: ephemeralUser?.currentFile || null
				}
			})

			const fileTree = await this.getFileTree(roomId)
			const recentMessages = await this.getRecentMessages(roomId)

			return {
				users,
				fileTree,
				recentMessages
			}
		} catch (err) {
			console.error("RoomStore.getFullRoomState error:", err)
			return {
				users: [],
				fileTree: [],
				recentMessages: []
			}
		}
	}

	async updateUserRole(roomId: string, userSocketId: string, role: UserRole): Promise<void> {
		try {
			await RoomModel.findOneAndUpdate(
				{ roomId, "members.socketId": userSocketId },
				{ $set: { "members.$.role": role } }
			)
			
			// Update in-memory room state
			const room = this.rooms.get(roomId)
			if (room) {
				room.permissions.set(userSocketId, role)
			}
		} catch (err) {
			console.error("RoomStore.updateUserRole error:", err)
		}
	}

	async _removeUserDb(roomId: string, userSocketId: string): Promise<void> {
		try {
			await RoomModel.findOneAndUpdate(
				{ roomId },
				{ $pull: { members: { socketId: userSocketId } } }
			)
			
			// Update in-memory room state
			const room = this.rooms.get(roomId)
			if (room) {
				room.permissions.delete(userSocketId)
			}
		} catch (err) {
			console.error("RoomStore._removeUserDb error:", err)
		}
	}
}

const roomStore = new RoomStore()
export { roomStore, RoomStore }