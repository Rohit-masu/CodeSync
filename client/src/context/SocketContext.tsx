import { DrawingData } from "@/types/app"
import {
    SocketContext as SocketContextType,
    SocketEvent,
    SocketId,
} from "@/types/socket"
import { PendingUser, RemoteUser, USER_STATUS, User, UserRole } from "@/types/user"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from "react"
import { toast } from "react-hot-toast"
import { Socket, io } from "socket.io-client"
import { useAppContext } from "./AppContext"
import { useAuth } from "./AuthContext"

const SocketContext = createContext<SocketContextType | null>(null)

export const useSocket = (): SocketContextType => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const SocketProvider = ({ children }: { children: ReactNode }) => {
    const {
        setUsers,
        setStatus,
        setCurrentUser,
        drawingData,
        setDrawingData,
        setPendingUsers,
        currentUser,
    } = useAppContext()
    const { token } = useAuth()

    // FIX BUG F1: Use useRef to prevent socket recreation on token changes
    const socketRef = useRef<Socket | null>(null)

    if (!socketRef.current) {
        socketRef.current = io(BACKEND_URL, {
            autoConnect: false,   // never auto-connect
            auth: { token: "" },
            query: { token: "" },
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            transports: ['websocket', 'polling'],
            forceNew: true,
        })
    }
    const socket = socketRef.current

    // Connect/disconnect imperatively when token changes
    useEffect(() => {
        if (token) {
            // Update auth token and connect
            socket.auth = { token }
            ;(socket as any).io.opts.query = { token }
            if (!socket.connected) socket.connect()
        } else {
            socket.disconnect()
        }
    }, [token, socket])

    // Error handling
    const handleError = useCallback(
        (err: any) => {
            console.log("socket error", err)
            const isAuthError =
                err?.message?.includes("Authentication required") ||
                err?.message?.includes("Invalid or expired token") ||
                err?.message?.includes("jwt") ||
                err?.message?.includes("token")

            if (isAuthError) {
                socket.disconnect()
                return
            }
            setStatus(USER_STATUS.CONNECTION_FAILED)
            toast.dismiss()
            toast.error("Failed to connect to the server")
        },
        [setStatus, socket],
    )

    const handleUsernameExist = useCallback(() => {
        console.log("USERNAME_EXISTS received")
        toast.dismiss()
        setStatus(USER_STATUS.INITIAL)
        toast.error("Username already exists in this room. Choose another.")
    }, [setStatus])

    // FIX BUG F2: Trust server role data, remove array index logic
    const handleJoiningAccept = useCallback(
        ({ user, users }: { user: User; users: RemoteUser[] }) => {
            console.log("JOIN_ACCEPTED received:", { user, users })
            
            // user.role comes from server - trust it completely
            setCurrentUser(user)
            setUsers(users)   // server already has correct roles per user
            setStatus(USER_STATUS.JOINED)
            toast.dismiss()
        },
        [setCurrentUser, setStatus, setUsers],
    )

    const handleJoinRejected = useCallback(
        ({ message }: { message: string }) => {
            console.log("JOIN_REJECTED received:", message)
            toast.dismiss()
            setStatus(USER_STATUS.DISCONNECTED)
            toast.error(message || "Your join request was declined by the host.")
        },
        [setStatus],
    )

    const handleJoinRequestPending = useCallback(
        (pendingUser: PendingUser) => {
            setPendingUsers((prev: PendingUser[]) => {
                const exists = prev.some(
                    (u) => u.socketId === pendingUser.socketId,
                )
                if (exists) return prev
                return [...prev, pendingUser]
            })
            toast(`${pendingUser.username} wants to join`, {
                icon: "??",
                duration: 8000,
            })
        },
        [setPendingUsers],
    )

    const handleUserLeft = useCallback(
        ({ user }: { user: User }) => {
            toast.success(`${user.username} left the room`)
            setUsers((prev: RemoteUser[]) =>
                prev.filter((u) => u.socketId !== user.socketId),
            )
        },
        [setUsers],
    )

    const handleRequestDrawing = useCallback(
        ({ socketId }: { socketId: SocketId }) => {
            socket.emit(SocketEvent.SYNC_DRAWING, { socketId, drawingData })
        },
        [drawingData, socket],
    )

    const handleDrawingSync = useCallback(
        ({ drawingData }: { drawingData: DrawingData }) => {
            setDrawingData(drawingData)
        },
        [setDrawingData],
    )

    const handlePermissionUpdate = useCallback(
        ({ socketId: updatedSocketId, role }: { socketId: string; role: UserRole }) => {
            setUsers((prev: RemoteUser[]) =>
                prev.map((u) => (u.socketId === updatedSocketId ? { ...u, role } : u))
            )
            // Update currentUser only if this update is for them
            if (currentUser.socketId === updatedSocketId) {
                toast.success(`Your role changed to ${role.toLowerCase()}`)
                setCurrentUser({ ...currentUser, role })
            }
        },
        [setCurrentUser, setUsers, currentUser],
    )

    const handleRoomPermissions = useCallback(
        ({ permissions }: { permissions: Array<{socketId: string; username: string; role: UserRole}> }) => {
            setUsers((prev: RemoteUser[]) => 
                prev.map(u => {
                    const perm = permissions.find(p => p.socketId === u.socketId)
                    return perm ? { ...u, role: perm.role } : u
                })
            )
        },
        [setUsers]
    )

    useEffect(() => {
        const handleConnect = () => {
            console.log("Socket connected successfully!")
            // If we have a roomId and username, we are reconnecting after a drop
            // We must re-send the JOIN_REQUEST to register our new socket ID
            if (currentUser.roomId && currentUser.username) {
                socket.emit(SocketEvent.JOIN_REQUEST, { roomId: currentUser.roomId })
            }
        }

        const handleDisconnect = () => {
            console.log("Socket disconnected")
        }

        // Add connection event listeners
        socket.on("connect", handleConnect)
        socket.on("disconnect", handleDisconnect)

        socket.on("connect_error", handleError)
        socket.on("connect_failed", handleError)
        socket.on(SocketEvent.USERNAME_EXISTS, handleUsernameExist)
        socket.on(SocketEvent.JOIN_ACCEPTED, handleJoiningAccept)
        socket.on(SocketEvent.JOIN_REJECTED, handleJoinRejected)
        socket.on(SocketEvent.JOIN_REQUEST_PENDING, handleJoinRequestPending)
        socket.on(SocketEvent.USER_DISCONNECTED, handleUserLeft)
        socket.on("room-members-updated", ({ users }: { users: RemoteUser[] }) => {
            setUsers(users)
        })
        socket.on(SocketEvent.REQUEST_DRAWING, handleRequestDrawing)
        socket.on(SocketEvent.SYNC_DRAWING, handleDrawingSync)
        
        // FIX BUG F7: Listen on correct event name for role updates
        socket.on("role-updated", handlePermissionUpdate)
        socket.on("room-permissions", handleRoomPermissions)
        socket.on(SocketEvent.KICKED, ({ message }: { message: string }) => {
            toast.error(message || "You have been removed from the room")
            setStatus(USER_STATUS.DISCONNECTED)
        })

        return () => {
            socket.off("connect", handleConnect)
            socket.off("disconnect", handleDisconnect)
            socket.off("connect_error")
            socket.off("connect_failed")
            socket.off(SocketEvent.USERNAME_EXISTS)
            socket.off(SocketEvent.JOIN_ACCEPTED)
            socket.off(SocketEvent.JOIN_REJECTED)
            socket.off(SocketEvent.JOIN_REQUEST_PENDING)
            socket.off(SocketEvent.USER_DISCONNECTED)
            socket.off(SocketEvent.REQUEST_DRAWING)
            socket.off(SocketEvent.SYNC_DRAWING)
            socket.off("role-updated")
            socket.off("room-permissions")
            socket.off(SocketEvent.KICKED)
        }
    }, [
        handleError,
        handleJoiningAccept,
        handleJoinRejected,
        handleJoinRequestPending,
        handleRequestDrawing,
        handleUserLeft,
        handleUsernameExist,
        handlePermissionUpdate,
        handleRoomPermissions,
        socket,
        currentUser.roomId,
        currentUser.username,
    ])

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    )
}

export { SocketProvider }
export default SocketContext
