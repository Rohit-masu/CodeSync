import { useAppContext } from "@/context/AppContext"
import { useAuth } from "@/context/AuthContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import { ChangeEvent, FormEvent, useEffect, useRef } from "react"
import { toast } from "react-hot-toast"
import { useLocation, useNavigate } from "react-router-dom"
import logo from "@/assets/logo.svg"
import axios from "axios"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const FormComponent = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { currentUser, setCurrentUser, status, setStatus } = useAppContext()
    const { socket } = useSocket()
    const { authUser, token, isAuthenticated } = useAuth()

    const roomIdRef = useRef<HTMLInputElement | null>(null)

    // ── Pre-fill username from logged-in user ────────────────────────────────
    useEffect(() => {
        if (authUser && !currentUser.username) {
            setCurrentUser({ ...currentUser, username: authUser.username })
        }
    }, [authUser])

    // ── Pre-fill roomId from navigation state ─────────────────────────────────
    useEffect(() => {
        if (currentUser.roomId.length > 0) return
        if (location.state?.roomId) {
            setCurrentUser({ ...currentUser, roomId: location.state.roomId })
        }
    }, [location.state?.roomId])

    // ── Generate room ID from backend ─────────────────────────────────────────
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
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setCurrentUser({ ...currentUser, roomId: res.data.roomId })
            toast.success("Room created! Share the Room ID to invite others.")
            roomIdRef.current?.focus()
        } catch {
            toast.error("Failed to create room. Please try again.")
        }
    }

    // ── Input changes ─────────────────────────────────────────────────────────
    const handleInputChanges = (e: ChangeEvent<HTMLInputElement>) => {
        const name = e.target.name
        const value = e.target.value
        setCurrentUser({ ...currentUser, [name]: value })
    }

    // ── Validation ────────────────────────────────────────────────────────────
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

    // ── Join room ─────────────────────────────────────────────────────────────
    const joinRoom = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (status === USER_STATUS.ATTEMPTING_JOIN) return
        if (!validateForm()) return
        toast.loading("Sending join request...")
        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        // Option B — server will ask host to approve
        socket.emit(SocketEvent.JOIN_REQUEST, { roomId: currentUser.roomId })
    }

    // ── Handle status changes ─────────────────────────────────────────────────
    const statusRef = useRef(status)
    
    useEffect(() => {
        statusRef.current = status
    }, [status])

    useEffect(() => {
        console.log("Status changed:", status, "currentUser:", currentUser)
        
        if (status === USER_STATUS.DISCONNECTED && !socket.connected) {
            socket.connect()
            return
        }

        if (status === USER_STATUS.JOINED && currentUser.roomId) {
            console.log("Navigating to editor:", currentUser.roomId)
            navigate(`/editor/${currentUser.roomId}`, {
                state: { username: currentUser.username },
            })
        }
    }, [status, socket.connected, currentUser.roomId, currentUser.username, navigate])

    return (
        <div className="flex w-full max-w-[500px] flex-col items-center justify-center gap-4 p-4 sm:w-[500px] sm:p-8">
            <img src={logo} alt="Logo" className="w-full" />

            {/* Auth status indicator */}
            {isAuthenticated ? (
                <div className="flex w-full items-center justify-between rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                        {authUser?.avatar ? (
                            <img
                                src={authUser.avatar}
                                alt={authUser.username}
                                className="h-6 w-6 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-black">
                                {authUser?.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm text-green-400">
                            Logged in as {authUser?.username}
                        </span>
                    </div>
                    <button
                        onClick={() => navigate("/profile")}
                        className="text-xs text-gray-400 underline hover:text-white"
                    >
                        Profile
                    </button>
                </div>
            ) : (
                <div className="flex w-full items-center justify-between rounded-md border border-gray-500/30 bg-gray-500/10 px-3 py-2">
                    <span className="text-sm text-gray-400">Not logged in</span>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate("/login")}
                            className="text-xs text-green-400 underline hover:text-green-300"
                        >
                            Login
                        </button>
                        <button
                            onClick={() => navigate("/register")}
                            className="text-xs text-gray-400 underline hover:text-white"
                        >
                            Register
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={joinRoom} className="flex w-full flex-col gap-4">
                <input
                    type="text"
                    name="roomId"
                    placeholder="Room Id"
                    className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                    onChange={handleInputChanges}
                    value={currentUser.roomId}
                    ref={roomIdRef}
                />
                {!isAuthenticated && (
                    <input
                        type="text"
                        name="username"
                        placeholder="Username"
                        className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                        onChange={handleInputChanges}
                        value={currentUser.username}
                    />
                )}
                <button
                    type="submit"
                    className="mt-2 w-full rounded-md bg-primary px-8 py-3 text-lg font-semibold text-black"
                >
                    {status === USER_STATUS.ATTEMPTING_JOIN
                        ? "Waiting for approval..."
                        : "Join"}
                </button>
            </form>
            <button
                className="cursor-pointer select-none text-sm text-white underline hover:text-primary"
                onClick={createNewRoomId}
            >
                Generate Unique Room Id
            </button>
        </div>
    )
}

export default FormComponent
