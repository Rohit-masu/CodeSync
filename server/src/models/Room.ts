import mongoose, { Schema } from "mongoose"

// Define interface without extending Document
export interface IRoomMember {
	userId: string
	username: string
	socketId: string
	role: string
	avatar: string | null
	joinedAt: Date
}

export interface IRoom {
	roomId: string
	hostSocketId: string
	hostUsername: string
	members: IRoomMember[]
	isActive: boolean
	lastActivityAt: Date
}

// Define schemas with explicit typing to avoid inference issues
const RoomMemberSchema: Schema = new Schema({
	userId: { type: String, required: false },
	username: { type: String, required: true },
	socketId: { type: String, required: true },
	role: {
		type: String,
		enum: ["host", "editor", "viewer", "HOST", "EDITOR", "VIEWER"],
		default: "VIEWER",
	},
	avatar: { type: String, default: null },
	joinedAt: { type: Date, default: Date.now },
}, { _id: false })

const RoomSchema: Schema = new Schema({
	roomId: {
		type: String,
		required: true,
		unique: true,
		index: true,
		trim: true,
	},
	hostSocketId: { type: String, required: true },
	hostUsername: { type: String, required: true },
	members: [RoomMemberSchema],
	isActive: { type: Boolean, default: true, index: true },
	lastActivityAt: { type: Date, default: Date.now },
}, { 
	timestamps: true 
})

// Add index
RoomSchema.index(
	{ lastActivityAt: 1 },
	{
		expireAfterSeconds: 60 * 60 * 24,
		partialFilterExpression: { isActive: false },
	}
)

// Add methods
RoomSchema.methods.getMember = function(socketId: string) {
	return this.members?.find((m: any) => m.socketId === socketId)
}

RoomSchema.methods.touchActivity = async function() {
	this.lastActivityAt = new Date()
	return await this.save()
}

export const RoomModel: any = mongoose.model("Room", RoomSchema)