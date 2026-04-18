import mongoose, { Schema } from "mongoose"

export interface IUser {
	userId: string
	username: string
	email: string
	passwordHash: string
	avatar: string | null
	roomId: string
	role: string
	status: string
	socketId: string
	cursorPosition: number
	typing: boolean
	currentFile: string | null
	selectionStart?: number
	selectionEnd?: number
	joinedAt: Date
	lastSeenAt: Date
}

const UserSchema = new Schema(
	{
		userId:        { type: String, required: true, unique: true, default: () => new mongoose.Types.ObjectId().toString() },
		username:      { type: String, required: true, trim: true, minlength: 1, maxlength: 50 },
		email:         { type: String, required: true, unique: true, trim: true, lowercase: true },
		passwordHash:  { type: String, required: true },
		avatar:        { type: String, default: null },   // Cloudinary URL
		roomId:        { type: String, default: "none" },
		role:          { type: String, enum: ["HOST", "EDITOR", "VIEWER"], default: "VIEWER" },
		status:        { type: String, enum: ["online", "offline"], default: "offline" },
		socketId:      { type: String, default: "none" },
		cursorPosition:{ type: Number, default: 0 },
		typing:        { type: Boolean, default: false },
		currentFile:   { type: String, default: null },
		selectionStart:{ type: Number },
		selectionEnd:  { type: Number },
		joinedAt:      { type: Date, default: Date.now },
		lastSeenAt:    { type: Date, default: Date.now },
	},
	{ timestamps: true }
)

export const UserModel = mongoose.model("User", UserSchema)