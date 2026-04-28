import logo from "@/assets/logo.svg"
import { useAppContext } from "@/context/AppContext"
import { useAuth } from "@/context/AuthContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import axios from "axios"
import { ChangeEvent, FormEvent, useEffect, useRef } from "react"
import { toast } from "react-hot-toast"
import { FiArrowRight, FiCopy, FiLink, FiLogIn, FiPlusCircle, FiShare2 } from "react-icons/fi"
import { useLocation, useNavigate } from "react-router-dom"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const FormComponent = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { currentUser, setCurrentUser, status, setStatus } = useAppContext()
    const { socket } = useSocket()
    const { authUser, token, isAuthenticated } = useAuth()

    const roomIdRef = useRef<HTMLInputElement | null>(null)
    const inviteLink = currentUser.roomId
        ? `${window.location.origin}/?roomId=${encodeURIComponent(currentUser.roomId)}`
        : ""

    useEffect(() => {
        if (authUser && !currentUser.username) {
            setCurrentUser({ ...currentUser, username: authUser.username })
        }
    }, [authUser])

    useEffect(() => {
        if (currentUser.roomId.length > 0) return

        if (location.state?.roomId) {
            setCurrentUser({ ...currentUser, roomId: location.state.roomId })
            return
        }

        const params = new URLSearchParams(location.search)
        const sharedRoomId = params.get("roomId")
        if (sharedRoomId) {
            setCurrentUser({ ...currentUser, roomId: sharedRoomId })
        }
    }, [location.search, location.state?.roomId])

    const createNewRoomId = async () => {
        if (!isAuthenticated) {
            toast.error("Please login to create a room")
            navigate("/login")
            return
        }
        try {
            const res = await axios.post(
                `${BACKEND_URL}/api/rooms`,
                { name: `${authUser?.username}'s Room` },
                { headers: { Authorization: `Bearer ${token}` } },
            )
            setCurrentUser({ ...currentUser, roomId: res.data.roomId })
            toast.success("Room created! Share the Room ID to invite others.")
            roomIdRef.current?.focus()
        } catch {
            toast.error("Failed to create room. Please try again.")
        }
    }

    const copyText = async (value: string, label: string) => {
        if (!value) {
            toast.error(`Create a room first to copy the ${label}.`)
            return
        }

        try {
            await navigator.clipboard.writeText(value)
            toast.success(`${label} copied to clipboard.`)
        } catch {
            toast.error(`Could not copy the ${label}.`)
        }
    }

    const shareInvite = async () => {
        if (!currentUser.roomId) {
            toast.error("Create a room first to share it.")
            return
        }

        const shareData = {
            title: "Join my CodeSync room",
            text: `Join my CodeSync room with ID: ${currentUser.roomId}`,
            url: inviteLink,
        }

        try {
            if (navigator.share) {
                await navigator.share(shareData)
                toast.success("Invite shared.")
                return
            }

            await navigator.clipboard.writeText(inviteLink)
            toast.success("Invite link copied to clipboard.")
        } catch {
            toast.error("Share was cancelled or unavailable.")
        }
    }

    const handleInputChanges = (e: ChangeEvent<HTMLInputElement>) => {
        const name = e.target.name
        const value = e.target.value
        setCurrentUser({ ...currentUser, [name]: value })
    }

    const validateForm = () => {
        if (!isAuthenticated) {
            toast.error("Please login first")
            navigate("/login")
            return false
        }
        if (currentUser.username.trim().length === 0) {
            toast.error("Enter your username")
            return false
        } else if (currentUser.roomId.trim().length === 0) {
            toast.error("Enter a room id")
            return false
        } else if (currentUser.roomId.trim().length < 5) {
            toast.error("Room ID must be at least 5 characters long")
            return false
        } else if (currentUser.username.trim().length < 3) {
            toast.error("Username must be at least 3 characters long")
            return false
        }
        return true
    }

    const joinRoom = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (status === USER_STATUS.ATTEMPTING_JOIN) return
        if (!validateForm()) return
        toast.loading("Sending join request...")
        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        socket.emit(SocketEvent.JOIN_REQUEST, { roomId: currentUser.roomId })
    }

    useEffect(() => {
        if (status === USER_STATUS.DISCONNECTED && !socket.connected && window.location.pathname === "/") {
            socket.connect()
            return
        }

        if (status === USER_STATUS.JOINED && currentUser.roomId) {
            navigate(`/editor/${currentUser.roomId}`, {
                state: { username: currentUser.username },
            })
        }
    }, [status, socket.connected, currentUser.roomId, currentUser.username, navigate])

    return (
        <div className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.98),rgba(33,36,41,0.96))] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <img src={logo} alt="Logo" className="w-40 sm:w-48" />
                    <p className="mt-3 max-w-sm text-sm leading-6 text-gray-400">
                        Create a room, copy the invite, and move straight into your collaborative editor.
                    </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Session</div>
                    <div className="mt-1 text-sm font-medium text-primary">
                        {isAuthenticated ? "Authenticated" : "Login required"}
                    </div>
                </div>
            </div>

            {isAuthenticated ? (
                <div className="mb-4 flex w-full items-center justify-between rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        {authUser?.avatar ? (
                            <img
                                src={authUser.avatar}
                                alt={authUser.username}
                                className="h-9 w-9 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-black">
                                {authUser?.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.18em] text-green-300/70">Logged in</p>
                            <p className="truncate text-sm font-medium text-green-200">{authUser?.username}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/profile")}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-primary/40 hover:text-white"
                    >
                        Profile
                    </button>
                </div>
            ) : (
                <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-sm text-gray-300">
                        Sign in first to create or join a room. Your editor logic stays the same, this just keeps room access tied to authenticated users.
                    </p>
                    <div className="mt-3 flex gap-3">
                        <button
                            onClick={() => navigate("/login")}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                        >
                            <FiLogIn />
                            Login
                        </button>
                        <button
                            onClick={() => navigate("/register")}
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-primary/40 hover:text-white"
                        >
                            Register
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Step 1</p>
                    <p className="mt-2 text-sm text-gray-200">Generate a room ID for your next coding session.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Step 2</p>
                    <p className="mt-2 text-sm text-gray-200">Copy or share the invite link from the same panel.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Step 3</p>
                    <p className="mt-2 text-sm text-gray-200">Join the room and wait for host approval when needed.</p>
                </div>
            </div>

            <form onSubmit={joinRoom} className="mt-6 flex w-full flex-col gap-4">
                <label className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    Room ID
                    <input
                        type="text"
                        name="roomId"
                        placeholder="Paste or generate a room ID"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-dark px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-primary/60 focus:outline-none"
                        onChange={handleInputChanges}
                        value={currentUser.roomId}
                        ref={roomIdRef}
                    />
                </label>

                {currentUser.roomId && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Current invite</p>
                                <p className="truncate text-base font-semibold text-white">{currentUser.roomId}</p>
                                <p className="mt-1 truncate text-xs text-gray-300">{inviteLink}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => copyText(currentUser.roomId, "Room ID")}
                                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-dark px-3 py-3 text-gray-200 transition hover:border-primary/40 hover:text-white"
                                    title="Copy room ID"
                                >
                                    <FiCopy />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => copyText(inviteLink, "invite link")}
                                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-dark px-3 py-3 text-gray-200 transition hover:border-primary/40 hover:text-white"
                                    title="Copy invite link"
                                >
                                    <FiLink />
                                </button>
                                <button
                                    type="button"
                                    onClick={shareInvite}
                                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-dark px-3 py-3 text-gray-200 transition hover:border-primary/40 hover:text-white"
                                    title="Share invite"
                                >
                                    <FiShare2 />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3 text-lg font-semibold text-black transition hover:opacity-90"
                >
                    {status === USER_STATUS.ATTEMPTING_JOIN ? "Waiting for approval..." : "Join"}
                    {status !== USER_STATUS.ATTEMPTING_JOIN && <FiArrowRight />}
                </button>
            </form>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/40 hover:bg-white/10"
                    onClick={createNewRoomId}
                    type="button"
                >
                    <FiPlusCircle />
                    Generate Room ID
                </button>
                <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/40 hover:bg-white/10"
                    onClick={shareInvite}
                    type="button"
                >
                    <FiShare2 />
                    Share Room
                </button>
            </div>
        </div>
    )
}

export default FormComponent
