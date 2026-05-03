import { Request, Response, Router } from "express"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import passport from "passport"
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import { signToken, requireAuth, JwtPayload } from "../middleware/auth"
import { UserModel } from "../models/User"
import { UserRole } from "../types/auth"

const router = Router()

const getFrontendUrl = () => process.env.CLIENT_URL || "http://localhost:5173"

const redirectToLogin = (res: Response, error: string) =>
    res.redirect(`${getFrontendUrl()}/login?error=${encodeURIComponent(error)}`)

const buildGoogleUsername = async (email: string) => {
    const baseUsername = email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 40) || "google-user"

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const suffix = Math.floor(1000 + Math.random() * 9000)
        const username = `${baseUsername}${suffix}`.slice(0, 50)
        const existingUser = await UserModel.findOne({ username })
        if (!existingUser) return username
    }

    return `google-${crypto.randomUUID().replace(/-/g, "").slice(0, 43)}`
}

router.post("/register", async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body

        if (!username || !email || !password) {
            return res.status(400).json({ error: "username, email and password are required" })
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" })
        }

        const existingEmail = await UserModel.findOne({ email })
        const existingUsername = await UserModel.findOne({ username })

        if (existingEmail) {
            return res.status(409).json({ error: "Email is already registered" })
        }

        if (existingUsername) {
            return res.status(409).json({ error: "Username is already taken" })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const user = await UserModel.create({
            username,
            email,
            passwordHash,
        })

        const token = signToken({
            username: user.get("username"),
            role: user.get("role") as UserRole,
        })

        return res.status(201).json({
            message: "Account created successfully",
            token,
            user: {
                id: user._id,
                username: user.get("username"),
                email: user.get("email"),
                avatar: user.get("avatar") ?? null,
            },
        })
    } catch (err: any) {
        console.error("Register error:", err)
        return res.status(500).json({ error: "Registration failed", details: err.message })
    }
})

router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" })
        }

        const user = await UserModel.findOne({ email })
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" })
        }

        const valid = await bcrypt.compare(password, user.get("passwordHash") as string)
        if (!valid) {
            return res.status(401).json({ error: "Invalid email or password" })
        }

        const token = signToken({
            username: user.get("username"),
            role: user.get("role") as UserRole,
        })

        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.get("username"),
                email: user.get("email"),
                avatar: user.get("avatar") ?? null,
            },
        })
    } catch (err: any) {
        console.error("Login error:", err)
        return res.status(500).json({ error: "Login failed", details: err.message })
    }
})

router.get("/me", requireAuth, async (_req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as JwtPayload
        const user = await UserModel.findOne({ username: auth.username })

        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }

        return res.json({
            id: user._id,
            username: user.get("username"),
            email: user.get("email"),
            avatar: user.get("avatar") ?? null,
            role: user.get("role") as UserRole,
            status: user.get("status"),
        })
    } catch (err: any) {
        console.error("Get profile error:", err)
        return res.status(500).json({ error: "Failed to fetch profile", details: err.message })
    }
})

router.put("/profile", requireAuth, async (req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as JwtPayload
        const { username } = req.body

        if (!username) {
            return res.status(400).json({ error: "username is required" })
        }

        const taken = await UserModel.findOne({ username })
        if (taken && taken.get("username") !== auth.username) {
            return res.status(409).json({ error: "Username is already taken" })
        }

        const user = await UserModel.findOneAndUpdate(
            { username: auth.username },
            { $set: { username } },
            { new: true },
        )

        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }

        const token = signToken({
            username: user.get("username"),
            role: auth.role,
        })

        return res.json({
            message: "Profile updated",
            token,
            user: {
                id: user._id,
                username: user.get("username"),
                email: user.get("email"),
                avatar: user.get("avatar") ?? null,
            },
        })
    } catch (err: any) {
        console.error("Update profile error:", err)
        return res.status(500).json({ error: "Failed to update profile", details: err.message })
    }
})

router.put("/password", requireAuth, async (req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as JwtPayload
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "currentPassword and newPassword are required" })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters" })
        }

        const user = await UserModel.findOne({ username: auth.username })
        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }

        const valid = await bcrypt.compare(currentPassword, user.get("passwordHash") as string)
        if (!valid) {
            return res.status(401).json({ error: "Current password is incorrect" })
        }

        const newHash = await bcrypt.hash(newPassword, 10)
        await UserModel.findOneAndUpdate(
            { username: auth.username },
            { $set: { passwordHash: newHash } },
        )

        return res.json({ message: "Password changed successfully" })
    } catch (err: any) {
        console.error("Change password error:", err)
        return res.status(500).json({ error: "Failed to change password", details: err.message })
    }
})

router.delete("/account", requireAuth, async (req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as JwtPayload
        const { password } = req.body

        if (!password) {
            return res.status(400).json({ error: "password is required to confirm deletion" })
        }

        const user = await UserModel.findOne({ username: auth.username })
        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }

        const valid = await bcrypt.compare(password, user.get("passwordHash") as string)
        if (!valid) {
            return res.status(401).json({ error: "Incorrect password" })
        }

        await UserModel.findOneAndDelete({ username: auth.username })

        return res.json({ message: "Account deleted successfully" })
    } catch (err: any) {
        console.error("Delete account error:", err)
        return res.status(500).json({ error: "Failed to delete account", details: err.message })
    }
})

const hasGoogleOAuthConfig =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET

if (hasGoogleOAuthConfig) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID!,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value
                    if (!email) {
                        return done(new Error("Google account did not provide an email address"), undefined)
                    }

                    let user = await UserModel.findOne({ email })

                    if (user) {
                        if (!user.get("avatar") && profile.photos?.[0]?.value) {
                            await UserModel.findByIdAndUpdate(user._id, {
                                $set: { avatar: profile.photos[0].value },
                            })
                        }
                        return done(null, user)
                    }

                    const username = await buildGoogleUsername(email)
                    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10)

                    user = await UserModel.create({
                        username,
                        email,
                        passwordHash,
                        avatar: profile.photos?.[0]?.value || null,
                    })

                    return done(null, user)
                } catch (error) {
                    return done(error, undefined)
                }
            },
        ),
    )

    router.get(
        "/google",
        passport.authenticate("google", {
            scope: ["profile", "email"],
        }),
    )

    router.get(
        "/google/callback",
        (req: Request, res: Response, next) => {
            passport.authenticate(
                "google",
                { session: false },
                (err: unknown, user: Express.User | false | null) => {
                    if (err) {
                        console.error("Google OAuth authentication error:", err)
                        return redirectToLogin(res, "google_auth_failed")
                    }

                    if (!user) {
                        return redirectToLogin(res, "google_auth_failed")
                    }

                    req.user = user
                    return next()
                },
            )(req, res, next)
        },
        async (req: Request, res: Response) => {
            try {
                const user = req.user as any
                if (!user) {
                    return redirectToLogin(res, "user_not_found")
                }

                const token = signToken({
                    username: user.get("username"),
                    role: user.get("role") as UserRole,
                })

                const frontendUrl = getFrontendUrl()
                return res.redirect(
                    `${frontendUrl}/auth/success?token=${token}&username=${user.get("username")}`,
                )
            } catch (error: any) {
                console.error("Google OAuth callback error:", error)
                return redirectToLogin(res, "auth_failed")
            }
        },
    )
} else {
    router.get("/google", (_req: Request, res: Response) => {
        return res.status(503).json({
            error: "Google OAuth is not configured yet",
            missing: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        })
    })

    router.get("/google/callback", (_req: Request, res: Response) => {
        return redirectToLogin(res, "google_oauth_not_configured")
    })
}

export default router
