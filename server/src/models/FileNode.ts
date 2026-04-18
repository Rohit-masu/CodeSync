import mongoose, { Schema } from "mongoose"

export type FileNodeType = "file" | "directory"

export interface IFileNode {
	roomId: string
	nodeId: string
	name: string
	type: FileNodeType
	parentId: string | null
	content: string
	language: string
	lastEditedBy: string
	lastEditedAt: Date
}

const FileNodeSchema = new Schema({
	roomId: { type: String, required: true, index: true },
	nodeId: { type: String, required: true, unique: true },
	name: { type: String, required: true, trim: true, maxlength: 255 },
	type: { type: String, enum: ["file", "directory"], required: true },
	parentId: { type: String, default: null },
	content: { type: String, default: "" },
	language: { type: String, default: "plaintext" },
	lastEditedBy: { type: String, default: "" },
	lastEditedAt: { type: Date, default: Date.now },
}, { 
	timestamps: true 
})

FileNodeSchema.index({ roomId: 1, nodeId: 1 }, { unique: true })
FileNodeSchema.index({ roomId: 1, parentId: 1 })

export const FileNodeModel = mongoose.model("FileNode", FileNodeSchema)