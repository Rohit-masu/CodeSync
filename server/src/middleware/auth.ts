import { Socket } from "socket.io"
import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { roomStore } from "../stores/roomStore"
import { RoomModel } from "../models/Room"
import { UserRole } from "../types/auth"

const JWT_SECRET = process.env.JWT_SECRET || "changeme_in_production"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h"

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export interface JwtPayload {
	username: string
	role: UserRole
}

export function signToken(payload: JwtPayload): string {
	// Cast expiresIn to `any` — @types/jsonwebtoken@9 expects StringValue, not string
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any })
}

export function verifyToken(token: string): JwtPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JwtPayload
	} catch {
		return null
	}
}

// ─── Express middleware ───────────────────────────────────────────────────────

export function requireAuth(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	const authHeader = req.headers.authorization
	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing or malformed Authorization header" })
		return
	}
	const token = authHeader.slice(7)
	const payload = verifyToken(token)
	if (!payload) {
		res.status(401).json({ error: "Invalid or expired token" })
		return
	}
	res.locals.auth = payload
	next()
}

export function requireHost(
	_req: Request,
	res: Response,
	next: NextFunction
): void {
	const auth = res.locals.auth as JwtPayload | undefined
	if (!auth || auth.role !== UserRole.HOST) {
		res.status(403).json({ error: "Only the room host can perform this action" })
		return
	}
	next()
}

export function requireWrite(
	_req: Request,
	res: Response,
	next: NextFunction
): void {
	const auth = res.locals.auth as JwtPayload | undefined
	if (!auth || auth.role === UserRole.VIEWER) {
		res.status(403).json({ error: "You have read-only access to this room" })
		return
	}
	next()
}

// ─── Socket guards ────────────────────────────────────────────────────────────

export async function withWritePermission(
	socket: Socket,
	roomId: string,
	handler: () => void | Promise<void>
): Promise<void> {
	if (roomStore.canWrite(roomId, socket.id)) {
		await handler()
		return
	}
	
	// roomStore.canWrite() is the single source of truth
	// No DB fallback - stale after reconnections
	socket.emit("permission-denied", {
		message: "You have read-only access to this room",
	})
}

export async function withHostPermission(
	socket: Socket,
	roomId: string,
	handler: () => void | Promise<void>
): Promise<void> {
	const role = roomStore.getUserRole(roomId, socket.id)
	if (role === UserRole.HOST) {
		await handler()
		return
	}
	
	// roomStore.getUserRole() is the single source of truth
	// No DB fallback - stale after reconnections
	socket.emit("permission-denied", {
		message: "Only the room host can perform this action",
	})
}