import { useAuth } from "@/context/AuthContext"
import { ChangeEvent, FormEvent, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { FiArrowLeft, FiCamera, FiLock, FiLogOut, FiMail, FiUser } from "react-icons/fi"
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

    const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
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
        <div className="min-h-screen bg-dark px-4 py-8 text-white">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Account settings</p>
                        <h1 className="mt-2 text-3xl font-semibold">Profile</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Keep your identity, login details, and avatar ready before you step back into a shared room.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate("/")}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-primary/40 hover:text-white"
                        >
                            <FiArrowLeft />
                            Back
                        </button>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
                        >
                            <FiLogOut />
                            Logout
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="space-y-6">
                        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.96),rgba(33,36,41,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                            <h2 className="mb-5 text-lg font-semibold">Identity</h2>
                            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
                                {authUser?.avatar ? (
                                    <img
                                        src={authUser.avatar}
                                        alt="Avatar"
                                        className="h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-primary/60"
                                    />
                                ) : (
                                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-4xl font-bold text-black">
                                        {authUser?.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 space-y-1 pt-1">
                                    <p className="truncate text-xl font-semibold">{authUser?.username}</p>
                                    <p className="truncate text-sm text-gray-400">{authUser?.email}</p>
                                    <p className="pt-2 text-xs uppercase tracking-[0.18em] text-primary">CodeSync member</p>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-3">
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
                                    className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                                >
                                    <FiCamera />
                                    {loadingAvatar ? "Uploading..." : "Upload Photo"}
                                </button>
                                {authUser?.avatar && (
                                    <button
                                        onClick={handleDeleteAvatar}
                                        disabled={loadingAvatar}
                                        className="inline-flex min-w-[170px] items-center justify-center rounded-xl border border-red-500/40 px-5 py-3 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        Remove Photo
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.96),rgba(33,36,41,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                <FiMail className="text-primary" />
                                Account details
                            </div>
                            <div className="space-y-3 text-sm text-gray-300">
                                <div className="rounded-xl border border-white/10 bg-dark px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Email</p>
                                    <p className="mt-1 truncate">{authUser?.email || ""}</p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-dark px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Status</p>
                                    <p className="mt-1">Authenticated and ready to join rooms</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.96),rgba(33,36,41,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                            <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                                <FiUser className="text-primary" />
                                Edit profile
                            </div>
                            <form onSubmit={handleProfileUpdate} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm text-gray-400">Email</label>
                                    <input
                                        type="text"
                                        value={authUser?.email || ""}
                                        disabled
                                        className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-gray-500"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm text-gray-400">Username</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white focus:border-primary/60 focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loadingProfile}
                                    className="inline-flex w-fit min-w-[180px] items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {loadingProfile ? "Saving..." : "Save Changes"}
                                </button>
                            </form>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.96),rgba(33,36,41,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                            <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                                <FiLock className="text-primary" />
                                Change password
                            </div>
                            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm text-gray-400">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white focus:border-primary/60 focus:outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm text-gray-400">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Choose a new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white focus:border-primary/60 focus:outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm text-gray-400">Confirm New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Repeat the new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white focus:border-primary/60 focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loadingPassword}
                                    className="inline-flex w-fit min-w-[180px] items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {loadingPassword ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage
