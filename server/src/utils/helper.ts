import { User } from "../types/user"
import { SocketId } from "../types/socket"

/**
 * Get all users currently in a room.
 */
function getUsersInRoom(userSocketMap: User[], roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId === roomId)
}

/**
 * Get the roomId for a given socketId.
 */
function getRoomId(userSocketMap: User[], socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId
	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

/**
 * Get a user by their socketId.
 */
function getUserBySocketId(
	userSocketMap: User[],
	socketId: SocketId
): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

export { getUsersInRoom, getRoomId, getUserBySocketId }
