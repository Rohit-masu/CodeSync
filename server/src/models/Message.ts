import mongoose, { Schema } from "mongoose"

export type MessageType = "text" | "system" | "code"

export interface IMessage {
	roomId: string
	username: string
	socketId: string
	content: string
	type: MessageType
	timestamp: Date
}

const MessageSchema = new Schema({
	roomId: { type: String, required: true, index: true },
	username: { type: String, required: true },
	socketId: { type: String, required: true },
	content: { type: String, required: true, maxlength: 10000 },
	type: { type: String, enum: ["text", "system", "code"], default: "text" },
	timestamp: { type: Date, default: Date.now },
}, { 
	timestamps: true 
})

MessageSchema.index({ roomId: 1, timestamp: -1 })
MessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 })

export const MessageModel = mongoose.model("Message", MessageSchema)