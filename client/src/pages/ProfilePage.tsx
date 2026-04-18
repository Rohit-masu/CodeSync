import { useAuth } from "@/context/AuthContext"
import { FormEvent, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { useNavigate } from "react-router-dom"

const ProfilePage = () => {
    const navigate = useNavigate()
    const {
        authUser,
        logout,
        updateProfile,
        updatePassword,
        uploadAvatar,
        deleteAvatar,
    } = useAuth()

    const [username, setUsername] = useState(authUser?.username || "")
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loadingProfile, setLoadingProfile] = useState(false)
    const [loadingPassword, setLoadingPassword] = useState(false)
    const [loadingAvatar, setLoadingAvatar] = useState(false)

    const fileRef = useRef<HTMLInputElement>(null)

    // ── Update username ───────────────────────────────────────────────────────
    const handleProfileUpdate = async (e: FormEvent) => {
        e.preventDefault()
        if (!username.trim()) {
            toast.error("Username cannot be empty")
            return
        }
        setLoadingProfile(true)
        try {
            await updateProfile(username)
            toast.success("Profile updated!")
        } catch (err: any) {
            toast.error(err?.response?.data?.error || "Update failed")
        } finally {
            setLoadingProfile(false)
        }
    }

    // ── Change password ───────────────────────────────────────────────────────
    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault()
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Fill in all password fields")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match")
            return
        }
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters")
            return
        }
        setLoadingPassword(true)
        try {
            await updatePassword(currentPassword, newPassword)
            toast.success("Password changed!")
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            toast.error(err?.response?.data?.error || "Password change failed")
        } finally {
            setLoadingPassword(false)
        }
    }

    // ── Upload avatar ─────────────────────────────────────────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLoadingAvatar(true)
        try {
            await uploadAvatar(file)
            toast.success("Avatar updated!")
        } catch (err: any) {
            toast.error(err?.response?.data?.error || "Upload failed")
        } finally {
            setLoadingAvatar(false)
        }
    }

    // ── Delete avatar ─────────────────────────────────────────────────────────
    const handleDeleteAvatar = async () => {
        setLoadingAvatar(true)
        try {
            await deleteAvatar()
            toast.success("Avatar removed")
        } catch (err: any) {
            toast.error(err?.response?.data?.error || "Delete failed")
        } finally {
            setLoadingAvatar(false)
        }
    }

    const handleLogout = () => {
        logout()
        navigate("/login")
        toast.success("Logged out")
    }

    return (
        <div className="min-h-screen bg-dark px-4 py-12">
            <div className="mx-auto max-w-lg">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-white">Profile</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate("/")}
                            className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:border-gray-400 hover:text-white"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleLogout}
                            className="rounded-md border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Avatar section */}
                <div className="mb-6 rounded-xl border border-gray-700 bg-darkHover p-6">
                    <h2 className="mb-4 text-lg font-semibold text-white">
                        Avatar
                    </h2>
                    <div className="flex items-center gap-6">
                        {authUser?.avatar ? (
                            <img
                                src={authUser.avatar}
                                alt="Avatar"
                                className="h-20 w-20 rounded-full object-cover ring-2 ring-green-500"
                            />
                        ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-3xl font-bold text-black">
                                {authUser?.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={handleAvatarUpload}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={loadingAvatar}
                                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                            >
                                {loadingAvatar ? "Uploading..." : "Upload Photo"}
                            </button>
                            {authUser?.avatar && (
                                <button
                                    onClick={handleDeleteAvatar}
                                    disabled={loadingAvatar}
                                    className="rounded-md border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                >
                                    Remove Photo
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Update username */}
                <div className="mb-6 rounded-xl border border-gray-700 bg-darkHover p-6">
                    <h2 className="mb-4 text-lg font-semibold text-white">
                        Edit Profile
                    </h2>
                    <form onSubmit={handleProfileUpdate} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-400">Email</label>
                            <input
                                type="text"
                                value={authUser?.email || ""}
                                disabled
                                className="w-full rounded-md border border-gray-700 bg-dark px-3 py-2 text-gray-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-400">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-md border border-gray-600 bg-dark px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loadingProfile}
                            className="rounded-md bg-primary px-4 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
                        >
                            {loadingProfile ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </div>

                {/* Change password */}
                <div className="rounded-xl border border-gray-700 bg-darkHover p-6">
                    <h2 className="mb-4 text-lg font-semibold text-white">
                        Change Password
                    </h2>
                    <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-400">
                                Current Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full rounded-md border border-gray-600 bg-dark px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-400">
                                New Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full rounded-md border border-gray-600 bg-dark px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-400">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full rounded-md border border-gray-600 bg-dark px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loadingPassword}
                            className="rounded-md bg-primary px-4 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
                        >
                            {loadingPassword ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage
