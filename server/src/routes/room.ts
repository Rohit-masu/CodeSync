import { Router, Request, Response } from "express"
import { RoomModel } from "../models/Room"
import { roomStore } from "../stores/roomStore"
import { requireAuth, JwtPayload } from "../middleware/auth"

const router = Router()

// Simple random room ID generator — no extra package needed
const generateRoomId = () => Math.random().toString(36).slice(2, 12)

// ─── POST /api/rooms ──────────────────────────────────────────────────────────
// Generates a unique room ID. Frontend calls this before connecting via socket.
// Body: { name? }
router.post("/", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth   = res.locals.auth as JwtPayload
		const roomId = generateRoomId()
		const name   = req.body?.name ?? `Room-${roomId}`
		return res.status(201).json({
			message:   "Room created — share this roomId to invite others",
			roomId,
			name,
			createdBy: auth.username,
		})
	} catch (err: any) {
		console.error("Create room error:", err)
		res.status(500).json({ error: "Failed to create room", details: err.message })
	}
})

// ─── GET /api/rooms/:roomId ───────────────────────────────────────────────────
// Returns room metadata + member list from DB.
router.get("/:roomId", async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params
		const room = await RoomModel.findOne({ roomId })

		if (!room)
			return res.status(404).json({ error: "Room not found or not yet active" })

		const members = (room.get("members") as any[]) ?? []

		return res.json({
			roomId:         room.get("roomId"),
			hostUsername:   room.get("hostUsername"),
			isActive:       room.get("isActive"),
			memberCount:    members.length,
			members:        members.map((m: any) => ({
				username: m.username,
				role:     m.role,
				joinedAt: m.joinedAt,
			})),
			createdAt:      room.get("createdAt"),
			lastActivityAt: room.get("lastActivityAt"),
		})
	} catch (err: any) {
		console.error("Get room error:", err)
		res.status(500).json({ error: "Failed to fetch room", details: err.message })
	}
})

// ─── GET /api/rooms/:roomId/members ──────────────────────────────────────────
// Live in-memory permission list (who is host/editor/viewer right now).
router.get("/:roomId/members", async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params
		const perms = roomStore.getRoomPermissions(roomId)

		if (perms.length === 0)
			return res.status(404).json({ error: "Room not active or has no members" })

		return res.json({ roomId, members: perms })
	} catch (err: any) {
		console.error("Get members error:", err)
		res.status(500).json({ error: "Failed to fetch members", details: err.message })
	}
})

// ─── GET /api/rooms/:roomId/messages ─────────────────────────────────────────
// Returns recent chat messages. Query: ?limit=20 (default 50, max 200)
router.get("/:roomId/messages", async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params
		const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
		const messages = await roomStore.getRecentMessages(roomId, limit)
		return res.json({ roomId, count: messages.length, messages })
	} catch (err: any) {
		console.error("Get messages error:", err)
		res.status(500).json({ error: "Failed to fetch messages", details: err.message })
	}
})

// ─── GET /api/rooms/:roomId/files ─────────────────────────────────────────────
// Returns the persisted file tree for a room.
router.get("/:roomId/files", async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params
		const files = await roomStore.getFileTree(roomId)
		return res.json({ roomId, count: files.length, files })
	} catch (err: any) {
		console.error("Get file tree error:", err)
		res.status(500).json({ error: "Failed to fetch file tree", details: err.message })
	}
})

export default router