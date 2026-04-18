import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { UserRole } from "./types/auth"
import { Server } from "socket.io"
import path from "path"
import axios from "axios"
import OpenAI from "openai"
import { connectDatabase } from "./config/database"
import { roomStore } from "./stores/roomStore"
import { getUsersInRoom, getRoomId, getUserBySocketId } from "./utils/helper"
import { withWritePermission, withHostPermission, verifyToken } from "./middleware/auth"
import { UserModel } from "./models/User"
import { RoomModel } from "./models/Room"
import { FileNodeModel } from "./models/FileNode"
import authRoutes from "./routes/auth"
import roomRoutes from "./routes/room"
import avatarRoutes from "./routes/avatar"

dotenv.config()

const app = express()
app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, "public")))

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes)
app.use("/api/rooms", roomRoutes)
app.use("/api/avatar", avatarRoutes)

const server = http.createServer(app)
const io = new Server(server, {
	cors: { origin: "*" },
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
	pingInterval: 25000,
	allowEIO3: true,
	transports: ['websocket', 'polling'],
})

// ─── Socket auth middleware ───────────────────────────────────────────────────
// Every socket connection MUST have a valid JWT — unregistered users rejected
io.use((socket, next) => {
	const token =
		(socket.handshake.auth as any)?.token ||
		(socket.handshake.query as any)?.token ||
		socket.handshake.headers?.authorization?.toString().replace("Bearer ", "")

	if (!token) {
		const err = new Error("Authentication required. Please login first.") as any
		err.data = { code: "AUTH_REQUIRED" }
		return next(err)
	}

	const payload = verifyToken(token)
	if (!payload) {
		const err = new Error("Invalid or expired token. Please login again.") as any
		err.data = { code: "TOKEN_INVALID" }
		return next(err)
	}

	// Attach decoded user to socket
	;(socket as any).authUser = payload
	next()
})

// ─── Permission events ────────────────────────────────────────────────────────
enum PermissionEvent {
	ROLE_UPDATED       = "role-updated",
	PERMISSION_DENIED  = "permission-denied",
	ASSIGN_ROLE        = "assign-role",
	TRANSFER_HOST      = "transfer-host",
	ROOM_PERMISSIONS   = "room-permissions",
}

// ─── Pending join requests (in-memory) ───────────────────────────────────────
// Key: roomId  Value: Map of socketId → { username, avatar }
const pendingRequests = new Map<string, Map<string, { username: string; avatar: string | null }>>()

let userSocketMap: User[] = []

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {

	const authUser = (socket as any).authUser

	// ── Join request ──────────────────────────────────────────────────────────
	// Step 1: User sends join-request
	// Step 2: If room is new → user becomes host and enters directly
	//         If room exists → request is sent to host for approval

	socket.on(SocketEvent.JOIN_REQUEST, async ({ roomId }: { roomId: string }) => {
		const username = authUser.username

		// Clean up any existing socket for this username
		const existingUser = getUsersInRoom(userSocketMap, roomId).find(
			(u: User) => u.username === username
		)
		if (existingUser) {
			// Emit disconnected event for the old socket
			socket.broadcast.to(roomId).emit(SocketEvent.USER_DISCONNECTED, { user: existingUser })
			
			// Remove the old socket from the map
			userSocketMap = userSocketMap.filter(u => u.socketId !== existingUser.socketId)
			
			// Also remove from roomStore to prevent ghost users in getFullRoomState
			await roomStore.removeUserFromRoom(roomId, existingUser.socketId)
			
			// Force the old socket to disconnect if it's still around
			const oldSocket = io.sockets.sockets.get(existingUser.socketId)
			if (oldSocket) {
				oldSocket.disconnect()
			}
		}

		// Fetch avatar from DB to show host in approval UI
		const dbUser = await UserModel.findOne({ username })
		const avatar = dbUser ? (dbUser.get("avatar") as string | null) : null

		// If room doesn't exist yet in memory
		if (!roomStore.roomExists(roomId)) {
			// We used to check if dbRoom existed to prevent rejoining, 
			// but since we now delete inactive rooms from the DB entirely, 
			// a non-existent room in memory is truly a brand new room.
			await _admitUser(socket, roomId, username, avatar)
			return
		}

		// Check if user already has a role in the room (rejoining)
		if (roomStore.hasUserRole(roomId, username)) {
			await _admitUser(socket, roomId, username, avatar)
			return
		}

		// Room exists → send approval request to host
		if (!pendingRequests.has(roomId)) {
			pendingRequests.set(roomId, new Map())
		}
		pendingRequests.get(roomId)!.set(socket.id, { username, avatar })

		// Notify host
		const hostSocketId = roomStore.getHostSocketId(roomId)
		if (!hostSocketId) {
			// No host found — admit directly as fallback
			await _admitUser(socket, roomId, username, avatar)
			return
		}

		io.to(hostSocketId).emit(SocketEvent.JOIN_REQUEST_PENDING, {
			socketId: socket.id,
			username,
			avatar,
		})

		console.log(`[JOIN_PENDING] ${username} is waiting for host approval in room ${roomId}`)
	})

	// ── Host approves join ────────────────────────────────────────────────────
	socket.on(SocketEvent.APPROVE_JOIN, async ({ socketId, roomId }: { socketId: string; roomId: string }) => {
		const roomPending = pendingRequests.get(roomId)
		const pending = roomPending?.get(socketId)

		if (!pending) {
			socket.emit(PermissionEvent.PERMISSION_DENIED, { message: "No pending request found" })
			return
		}

		// Verify requester is host
		const requesterRole = roomStore.getUserRole(roomId, socket.id)
		if (requesterRole !== UserRole.HOST) {
			socket.emit(PermissionEvent.PERMISSION_DENIED, { message: "Only the host can approve requests" })
			return
		}

		// Remove from pending
		roomPending!.delete(socketId)

		// Admit the user
		const targetSocket = io.sockets.sockets.get(socketId)
		if (!targetSocket) {
			socket.emit(PermissionEvent.PERMISSION_DENIED, { message: "User disconnected before approval" })
			return
		}

		await _admitUser(targetSocket, roomId, pending.username, pending.avatar)
	})

	// ── Host rejects join ─────────────────────────────────────────────────────
	socket.on(SocketEvent.REJECT_JOIN, ({ socketId, roomId }: { socketId: string; roomId: string }) => {
		const roomPending = pendingRequests.get(roomId)
		const pending = roomPending?.get(socketId)

		if (!pending) return

		// Verify requester is host
		const requesterRole = roomStore.getUserRole(roomId, socket.id)
		if (requesterRole !== UserRole.HOST) {
			socket.emit(PermissionEvent.PERMISSION_DENIED, { message: "Only the host can reject requests" })
			return
		}

		roomPending!.delete(socketId)

		// Notify rejected user
		io.to(socketId).emit(SocketEvent.JOIN_REJECTED, {
			message: "Your request to join was declined by the host",
		})

		console.log(`[JOIN_REJECTED] ${pending.username} was rejected from room ${roomId}`)
	})

	// ── Leave ─────────────────────────────────────────────────────────────────
	socket.on("disconnecting", async () => {
		const user = getUserBySocketId(userSocketMap, socket.id)
		if (!user) {
			// User was in pending — clean up
			pendingRequests.forEach((pending) => pending.delete(socket.id))
			return
		}

		const { roomId } = user
		socket.broadcast.to(roomId).emit(SocketEvent.USER_DISCONNECTED, { user })

		const newHostSocketId = await roomStore.removeUserFromRoom(roomId, socket.id)
		if (newHostSocketId) {
			const newHostUser = getUserBySocketId(userSocketMap, newHostSocketId)
			io.to(roomId).emit(PermissionEvent.ROLE_UPDATED, {
				socketId: newHostSocketId,
				username: newHostUser?.username ?? "",
				role: UserRole.HOST,
			})
		}

		userSocketMap = userSocketMap.filter((u: User) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// ── Permission management (host only) ─────────────────────────────────────

	socket.on(PermissionEvent.ASSIGN_ROLE, async ({ targetSocketId, role }: { targetSocketId: string; role: UserRole }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return

		await withHostPermission(socket, roomId, async () => {
			const result = await roomStore.setUserRole(roomId, socket.id, targetSocketId, role)
			if (!result.success) {
				socket.emit(PermissionEvent.PERMISSION_DENIED, { message: result.error })
				return
			}
			const targetUser = getUserBySocketId(userSocketMap, targetSocketId)
			io.to(roomId).emit(PermissionEvent.ROLE_UPDATED, {
				socketId: targetSocketId,
				username: targetUser?.username ?? "",
				role,
			})
		})
	})

	socket.on(PermissionEvent.TRANSFER_HOST, async ({ newHostSocketId }: { newHostSocketId: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return

		await withHostPermission(socket, roomId, async () => {
			const result = await roomStore.transferHost(roomId, socket.id, newHostSocketId)
			if (!result.success) {
				socket.emit(PermissionEvent.PERMISSION_DENIED, { message: result.error })
				return
			}
			io.to(roomId).emit(PermissionEvent.ROLE_UPDATED, {
				socketId: socket.id,
				username: getUserBySocketId(userSocketMap, socket.id)?.username ?? "",
				role: UserRole.EDITOR,
			})
			io.to(roomId).emit(PermissionEvent.ROLE_UPDATED, {
				socketId: newHostSocketId,
				username: getUserBySocketId(userSocketMap, newHostSocketId)?.username ?? "",
				role: UserRole.HOST,
			})
		})
	})

	// ── File structure ────────────────────────────────────────────────────────

	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		async ({ fileStructure, openFiles, activeFile, socketId }: {
			fileStructure: unknown; openFiles: unknown; activeFile: unknown; socketId: string
		}) => {
			const roomId = getRoomId(userSocketMap, socket.id)
			if (!roomId) return
			
			withWritePermission(socket, roomId, async () => {
				// Persist file structure to DB if provided by host/editor
				if (fileStructure && typeof fileStructure === 'object') {
					// This would require more complex logic to sync entire file tree
					// For now, we'll just forward the sync request
					// In a full implementation, this would update the DB with the new structure
				}
				
				io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, { fileStructure, openFiles, activeFile })
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_CREATED, ({ parentDirId, newDirectory }: { parentDirId: string; newDirectory: unknown }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, { parentDirId, newDirectory })
			// Extract directory data and persist to DB
			if (newDirectory && typeof newDirectory === 'object' && 'id' in newDirectory) {
				await roomStore.upsertFileNode(roomId, (newDirectory as any).id, {
					name: (newDirectory as any).name,
					type: 'directory',
					parentId: parentDirId
				})
			}
		})
	})

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }: { dirId: string; children: unknown }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, { dirId, children })
			// For directory updates, we might need to update children structure
			// This might require a more complex update depending on the data structure
			// For now, we'll update the directory node
			await roomStore.upsertFileNode(roomId, dirId, { type: 'directory' })
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }: { dirId: string; newName: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, { dirId, newName })
			await roomStore.upsertFileNode(roomId, dirId, { name: newName })
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }: { dirId: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_DELETED, { dirId })
			await roomStore.deleteFileNode(roomId, dirId)
		})
	})

	socket.on(SocketEvent.FILE_CREATED, async ({ parentDirId, newFile }: { parentDirId: string; newFile: unknown }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
			// Extract file data and persist to DB
			if (newFile && typeof newFile === 'object' && 'id' in newFile) {
				await roomStore.upsertFileNode(roomId, (newFile as any).id, {
					name: (newFile as any).name,
					type: 'file',
					parentId: parentDirId,
					content: (newFile as any).content || '',
					language: (newFile as any).language || 'plaintext'
				})
			}
			const authUser = (socket as any).authUser
			if (newFile && typeof newFile === 'object' && 'id' in newFile) {
				await roomStore.updateMetrics(roomId, authUser.username, "FILE_CREATED", { 
					fileId: (newFile as any).id, 
					content: (newFile as any).content || '' 
				})
			}
		})
	})

	socket.on(SocketEvent.FILE_UPDATED, async ({ fileId, newContent }: { fileId: string; newContent: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, { fileId, newContent })
			
			const authUser = (socket as any).authUser
			// Calculate analytics using our fast memory cache in roomStore
			await roomStore.updateMetrics(roomId, authUser.username, "FILE_UPDATED", { fileId, newContent })

			await roomStore.upsertFileNode(roomId, fileId, { content: newContent })
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }: { fileId: string; newName: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, { fileId, newName })
			await roomStore.upsertFileNode(roomId, fileId, { name: newName })
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }: { fileId: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, async () => {
			socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
			await roomStore.deleteFileNode(roomId, fileId)
			const authUser = (socket as any).authUser
			await roomStore.updateMetrics(roomId, authUser.username, "FILE_DELETED", { fileId })
		})
	})

	// ── User status ───────────────────────────────────────────────────────────

	socket.on(SocketEvent.REQUEST_METRICS, async () => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		const analytics = await roomStore.getAnalytics(roomId)
		socket.emit(SocketEvent.USER_METRICS, analytics)
	})

	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }: { socketId: string }) => {
		userSocketMap = userSocketMap.map((user: User) =>
			user.socketId === socketId ? { ...user, status: USER_CONNECTION_STATUS.OFFLINE } : user
		)
		const roomId = getRoomId(userSocketMap, socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }: { socketId: string }) => {
		userSocketMap = userSocketMap.map((user: User) =>
			user.socketId === socketId ? { ...user, status: USER_CONNECTION_STATUS.ONLINE } : user
		)
		const roomId = getRoomId(userSocketMap, socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// ── Chat ──────────────────────────────────────────────────────────────────

	socket.on(SocketEvent.SEND_MESSAGE, async ({ message }: {
		message: { username: string; content: string; type?: "text" | "system" | "code" }
	}) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		
		// Validate message content before processing
		if (!message.content || message.content.trim() === "") {
			console.warn("SEND_MESSAGE: content is empty or undefined, ignoring")
			return
		}
		
		await roomStore.saveMessage(roomId, message.username, socket.id, message.content, message.type ?? "text")
		socket.broadcast.to(roomId).emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	
	socket.on("REQUEST_FULL_STATE", async () => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		
		const fullRoomState = await roomStore.getFullRoomState(roomId, userSocketMap)
		socket.emit("FULL_STATE_SYNC", fullRoomState)
	})

	socket.on("KICK_USER", async ({ userSocketId }: { userSocketId: string }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		
		// Verify requester is host
		const requesterRole = roomStore.getUserRole(roomId, socket.id)
		if (requesterRole !== UserRole.HOST) {
			socket.emit(PermissionEvent.PERMISSION_DENIED, { message: "Only the host can kick users" })
			return
		}
		
		// Get username before removing from map
		const kickedUser = getUserBySocketId(userSocketMap, userSocketId)
		
		// Remove user from room
		const targetSocket = io.sockets.sockets.get(userSocketId)
		if (targetSocket) {
			targetSocket.emit(SocketEvent.KICKED, { message: "You have been removed from the room" })
			targetSocket.leave(roomId)
			targetSocket.disconnect()
		}
		
		// Remove from user map
		userSocketMap = userSocketMap.filter(user => user.socketId !== userSocketId)
		
		// Remove from room in-memory state first
		await roomStore.removeUserFromRoom(roomId, userSocketId)
		
		// Remove from user roles so they can't bypass approval
		if (kickedUser) {
			roomStore.removeUserRole(roomId, kickedUser.username)
		}
		
		// Then handle DB-only removal
		await roomStore._removeUserDb(roomId, userSocketId)
		
		// Notify remaining users
		socket.broadcast.to(roomId).emit(SocketEvent.USER_DISCONNECTED, { 
			user: { socketId: userSocketId, username: kickedUser?.username || "Unknown" }
		})
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user: User) =>
			user.socketId === socket.id ? { ...user, typing: false } : user
		)
		const user = getUserBySocketId(userSocketMap, socket.id)
		if (!user) return
		socket.broadcast.to(user.roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	socket.on(SocketEvent.CURSOR_MOVE, ({ cursorPosition, selectionStart, selectionEnd }: {
		cursorPosition: number; selectionStart?: number; selectionEnd?: number
	}) => {
		userSocketMap = userSocketMap.map((user: User) =>
			user.socketId === socket.id
				? { ...user, cursorPosition, selectionStart, selectionEnd }
				: user
		)
		const user = getUserBySocketId(userSocketMap, socket.id)
		if (!user) return
		socket.broadcast.to(user.roomId).emit(SocketEvent.CURSOR_MOVE, { user })
	})

	// ── Drawing ───────────────────────────────────────────────────────────────

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }: { drawingData: unknown; socketId: string }) => {
		socket.broadcast.to(socketId).emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }: { snapshot: unknown }) => {
		const roomId = getRoomId(userSocketMap, socket.id)
		if (!roomId) return
		withWritePermission(socket, roomId, () => {
			socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, { snapshot })
		})
	})
})

// ─── Helper: admit a user into a room ────────────────────────────────────────
async function _admitUser(
	socket: any,
	roomId: string,
	username: string,
	avatar: string | null
) {
	const role = await roomStore.addUserToRoom(roomId, socket.id, username, avatar)

	const user: User = {
		username,
		roomId,
		role, // Include role directly in user object
		status: USER_CONNECTION_STATUS.ONLINE,
		cursorPosition: 0,
		typing: false,
		socketId: socket.id,
		currentFile: null,
	}

	userSocketMap.push(user)
	socket.join(roomId)

	// Tell existing members someone joined
	socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user: { ...user, avatar } })

	// Tell all members that users list has been updated
	const updatedFullState = await roomStore.getFullRoomState(roomId, userSocketMap)
	socket.broadcast.to(roomId).emit("room-members-updated", {
		users: updatedFullState.users
	})

	const users = getUsersInRoom(userSocketMap, roomId)
	const recentMessages = await roomStore.getRecentMessages(roomId)

	// Small delay to ensure socketIdToUsername mapping is updated before getFullRoomState
	await new Promise(resolve => setTimeout(resolve, 10))

	// Tell the joining user they're accepted with full room state
	const fullRoomState = await roomStore.getFullRoomState(roomId, userSocketMap)
	socket.emit(SocketEvent.JOIN_ACCEPTED, {
		user: { ...user, avatar },
		users: fullRoomState.users,
		avatar,
		recentMessages: fullRoomState.recentMessages,
		fileTree: fullRoomState.fileTree,
	})

	// Send full permission map to joining user
	const rawPerms = roomStore.getRoomPermissions(roomId)
	const roomDoc = await RoomModel.findOne({ roomId })
	const members = roomDoc?.members || []
	const permissions = rawPerms.map((p: any) => {
		const member = members.find(m => m.socketId === p.socketId)
		return {
			...p,
			username: getUserBySocketId(userSocketMap, p.socketId)?.username ?? "",
			avatar: member?.avatar || null
		}
	})
	socket.emit(PermissionEvent.ROOM_PERMISSIONS, { permissions })

	console.log(`[ADMITTED] ${username} joined room ${roomId} as ${role}`)
}

// ─── REST endpoints ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000
const PISTON_URL = process.env.PISTON_URL || "http://localhost:2000"

app.post("/api/execute", async (req: Request, res: Response) => {
	try {
		const { language, version, files, stdin } = req.body
		if (!language || !version || !files || !Array.isArray(files)) {
			return res.status(400).json({ error: "Missing required parameters: language, version, files" })
		}
		// Now this becomes: https://emkc.org/api/v2/piston/execute
		const pistonResponse = await axios.post(`${PISTON_URL}/execute`, {
			language, version, files, stdin: stdin || "",
		})
		res.json(pistonResponse.data)
	} catch (error: any) {
		console.error("Code execution error:", error)
		res.status(500).json({ error: "Failed to execute code", details: error?.response?.data || error?.message })
	}
})

app.get("/api/runtimes", async (_req: Request, res: Response) => {
	try {
		// Now this becomes: https://emkc.org/api/v2/piston/runtimes
		const pistonResponse = await axios.get(`${PISTON_URL}/runtimes`)
		res.json(pistonResponse.data)
	} catch (error: any) {
		console.error("Failed to fetch runtimes:", error)
		res.status(500).json({ error: "Failed to fetch supported languages", details: error?.response?.data || error?.message })
	}
})

app.post("/api/copilot", async (req: Request, res: Response) => {
	try {
		const { messages, model } = req.body
		if (!messages || !Array.isArray(messages)) {
			return res.status(400).json({ error: "Missing required parameter: messages" })
		}
		const apiKey = process.env.GROQ_API_KEY
		if (!apiKey) {
			return res.status(500).json({ error: "GROQ_API_KEY not found in environment variables" })
		}
		const openai = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" })
		const completion = await openai.chat.completions.create({
			model: model || "llama-3.3-70b-versatile",
			messages,
			max_tokens: 4000,
			temperature: 0.7,
		})
		res.json({ choices: [{ message: { content: completion.choices[0].message.content } }] })
	} catch (error: any) {
		console.error("Groq API error:", error)
		res.status(500).json({ error: "Failed to generate code", details: error?.response?.data || error?.message })
	}
})

app.get("/", (_req: Request, res: Response) => {
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
	await connectDatabase()
	server.listen(PORT, () => {
		console.log(`Listening on port ${PORT}`)
	})
}

start()

export { PermissionEvent }