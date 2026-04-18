enum UserRole {
	HOST = "HOST",
	EDITOR = "EDITOR",
	VIEWER = "VIEWER",
}

interface AuthUser {
	username: string
	roomId: string
	role: UserRole
	token: string
}

interface JoinRoomPayload {
	roomId: string
	username: string
}

interface RoomPermission {
	socketId: string
	username: string
	role: UserRole
}

export { UserRole, AuthUser, JoinRoomPayload, RoomPermission }
