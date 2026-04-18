import { Router, Request, Response } from "express"
import multer from "multer"
import { v2 as cloudinary } from "cloudinary"
import { UserModel } from "../models/User"
import { requireAuth, JwtPayload } from "../middleware/auth"

const router = Router()

// ─── Multer — memory storage (no disk writes) ─────────────────────────────────
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
		if (allowed.includes(file.mimetype)) {
			cb(null, true)
		} else {
			cb(new Error("Only JPEG, PNG, WEBP and GIF images are allowed"))
		}
	},
})

// ─── POST /api/avatar ─────────────────────────────────────────────────────────
router.post(
	"/",
	requireAuth,
	upload.single("avatar"),
	async (req: Request & { file?: multer.File }, res: Response) => {
		try {
			if (!req.file) {
				return res.status(400).json({ error: "No file uploaded. Use field name 'avatar'" })
			}

			const auth = res.locals.auth as JwtPayload

			// Config here — dotenv already loaded by this point
			cloudinary.config({
				cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
				api_key:    process.env.CLOUDINARY_API_KEY,
				api_secret: process.env.CLOUDINARY_API_SECRET,
			})

			const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
				(resolve, reject) => {
					const stream = cloudinary.uploader.upload_stream(
						{
							folder:         "codecollab/avatars",
							public_id:      `avatar_${auth.username}`,
							overwrite:      true,
							transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }],
						},
						(error, result) => {
							if (error || !result) return reject(error ?? new Error("Upload failed"))
							resolve({ secure_url: result.secure_url, public_id: result.public_id })
						}
					)
					stream.end(req.file!.buffer)
				}
			)

			const user = await UserModel.findOneAndUpdate(
				{ username: auth.username },
				{ $set: { avatar: uploadResult.secure_url } },
				{ new: true }
			)

			if (!user) return res.status(404).json({ error: "User not found" })

			return res.json({
				message: "Avatar updated successfully",
				avatar:  uploadResult.secure_url,
				user: {
					id:       user._id,
					username: user.get("username"),
					email:    user.get("email"),
					avatar:   uploadResult.secure_url,
				},
			})
		} catch (err: any) {
			console.error("Avatar upload error:", err)
			res.status(500).json({ error: "Failed to upload avatar", details: err.message })
		}
	}
)

// ─── DELETE /api/avatar ───────────────────────────────────────────────────────
router.delete("/", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth = res.locals.auth as JwtPayload

		cloudinary.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key:    process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
		})

		await cloudinary.uploader.destroy(`codecollab/avatars/avatar_${auth.username}`)

		await UserModel.findOneAndUpdate(
			{ username: auth.username },
			{ $set: { avatar: null } }
		)

		return res.json({ message: "Avatar removed" })
	} catch (err: any) {
		console.error("Avatar delete error:", err)
		res.status(500).json({ error: "Failed to remove avatar", details: err.message })
	}
})

export default router