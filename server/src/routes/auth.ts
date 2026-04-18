import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { UserModel } from "../models/User"
import { signToken, requireAuth, JwtPayload } from "../middleware/auth"
import { UserRole } from "../types/auth"

const router = Router()

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
	try {
		const { username, email, password } = req.body

		if (!username || !email || !password)
			return res.status(400).json({ error: "username, email and password are required" })

		if (password.length < 6)
			return res.status(400).json({ error: "Password must be at least 6 characters" })

		// Check for duplicates
		const existingEmail    = await UserModel.findOne({ email })
		const existingUsername = await UserModel.findOne({ username })

		if (existingEmail)    return res.status(409).json({ error: "Email is already registered" })
		if (existingUsername) return res.status(409).json({ error: "Username is already taken" })

		const passwordHash = await bcrypt.hash(password, 10)

		const user = await UserModel.create({
			username,
			email,
			passwordHash,
		})

		const token = signToken({
			username: user.get("username"),
			role:     user.get("role") as UserRole,
		})

		return res.status(201).json({
			message: "Account created successfully",
			token,
			user: {
				id:       user._id,
				username: user.get("username"),
				email:    user.get("email"),
				avatar:   user.get("avatar") ?? null,
			},
		})
	} catch (err: any) {
		console.error("Register error:", err)
		res.status(500).json({ error: "Registration failed", details: err.message })
	}
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body

		if (!email || !password)
			return res.status(400).json({ error: "email and password are required" })

		const user = await UserModel.findOne({ email })
		if (!user)
			return res.status(401).json({ error: "Invalid email or password" })

		const valid = await bcrypt.compare(password, user.get("passwordHash") as string)
		if (!valid)
			return res.status(401).json({ error: "Invalid email or password" })

		const token = signToken({
			username: user.get("username"),
			role:     user.get("role") as UserRole,
		})

		return res.json({
			message: "Login successful",
			token,
			user: {
				id:       user._id,
				username: user.get("username"),
				email:    user.get("email"),
				avatar:   user.get("avatar") ?? null,
			},
		})
	} catch (err: any) {
		console.error("Login error:", err)
		res.status(500).json({ error: "Login failed", details: err.message })
	}
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the logged-in user's profile.
// Requires: Authorization: Bearer <token>
router.get("/me", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth = res.locals.auth as JwtPayload
		const user = await UserModel.findOne({ username: auth.username })

		if (!user) return res.status(404).json({ error: "User not found" })

		return res.json({
			id:       user._id,
			username: user.get("username"),
			email:    user.get("email"),
			avatar:   user.get("avatar") ?? null,
			role:     user.get("role") as UserRole,
			status:   user.get("status"),
		})
	} catch (err: any) {
		console.error("Get profile error:", err)
		res.status(500).json({ error: "Failed to fetch profile", details: err.message })
	}
})

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
// Update username.
// Requires: Authorization: Bearer <token>
// Body: { username }
router.put("/profile", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth = res.locals.auth as JwtPayload
		const { username } = req.body

		if (!username)
			return res.status(400).json({ error: "username is required" })

		// Make sure new username isn't taken by someone else
		const taken = await UserModel.findOne({ username })
		if (taken && taken.get("username") !== auth.username)
			return res.status(409).json({ error: "Username is already taken" })

		const user = await UserModel.findOneAndUpdate(
			{ username: auth.username },
			{ $set: { username } },
			{ new: true }
		)

		if (!user) return res.status(404).json({ error: "User not found" })

		// Re-issue token with new username
		const token = signToken({
			username: user.get("username"),
			role:     auth.role,
		})

		return res.json({
			message: "Profile updated",
			token,
			user: {
				id:       user._id,
				username: user.get("username"),
				email:    user.get("email"),
				avatar:   user.get("avatar") ?? null,
			},
		})
	} catch (err: any) {
		console.error("Update profile error:", err)
		res.status(500).json({ error: "Failed to update profile", details: err.message })
	}
})

// ─── PUT /api/auth/password ───────────────────────────────────────────────────
// Change password.
// Requires: Authorization: Bearer <token>
// Body: { currentPassword, newPassword }
router.put("/password", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth = res.locals.auth as JwtPayload
		const { currentPassword, newPassword } = req.body

		if (!currentPassword || !newPassword)
			return res.status(400).json({ error: "currentPassword and newPassword are required" })

		if (newPassword.length < 6)
			return res.status(400).json({ error: "New password must be at least 6 characters" })

		const user = await UserModel.findOne({ username: auth.username })
		if (!user) return res.status(404).json({ error: "User not found" })

		const valid = await bcrypt.compare(currentPassword, user.get("passwordHash") as string)
		if (!valid)
			return res.status(401).json({ error: "Current password is incorrect" })

		const newHash = await bcrypt.hash(newPassword, 10)
		await UserModel.findOneAndUpdate(
			{ username: auth.username },
			{ $set: { passwordHash: newHash } }
		)

		return res.json({ message: "Password changed successfully" })
	} catch (err: any) {
		console.error("Change password error:", err)
		res.status(500).json({ error: "Failed to change password", details: err.message })
	}
})

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
// Permanently deletes the user account.
// Requires: Authorization: Bearer <token>
// Body: { password }
router.delete("/account", requireAuth, async (req: Request, res: Response) => {
	try {
		const auth = res.locals.auth as JwtPayload
		const { password } = req.body

		if (!password)
			return res.status(400).json({ error: "password is required to confirm deletion" })

		const user = await UserModel.findOne({ username: auth.username })
		if (!user) return res.status(404).json({ error: "User not found" })

		const valid = await bcrypt.compare(password, user.get("passwordHash") as string)
		if (!valid)
			return res.status(401).json({ error: "Incorrect password" })

		await UserModel.findOneAndDelete({ username: auth.username })

		return res.json({ message: "Account deleted successfully" })
	} catch (err: any) {
		console.error("Delete account error:", err)
		res.status(500).json({ error: "Failed to delete account", details: err.message })
	}
})

export default router