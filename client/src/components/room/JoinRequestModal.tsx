import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { PendingUser } from "@/types/user"
import { toast } from "react-hot-toast"

const JoinRequestModal = () => {
    const { pendingUsers, setPendingUsers, currentUser } = useAppContext()
    const { socket } = useSocket()

    if (!pendingUsers || pendingUsers.length === 0) return null

    const approve = (user: PendingUser) => {
        // ✅ Check if socket exists and has emit method
        if (!socket || typeof socket.emit !== 'function') {
            toast.error("Socket not connected. Please refresh the page.")
            return
        }
        
        socket.emit(SocketEvent.APPROVE_JOIN, {
            socketId: user.socketId,
            roomId: currentUser.roomId,
        })
        setPendingUsers((prev: PendingUser[]) =>
            prev.filter((u) => u.socketId !== user.socketId)
        )
        toast.success(`${user.username} admitted to the room`)
    }

    const reject = (user: PendingUser) => {
        // ✅ Check if socket exists and has emit method
        if (!socket || typeof socket.emit !== 'function') {
            toast.error("Socket not connected. Please refresh the page.")
            return
        }
        
        socket.emit(SocketEvent.REJECT_JOIN, {
            socketId: user.socketId,
            roomId: currentUser.roomId,
        })
        setPendingUsers((prev: PendingUser[]) =>
            prev.filter((u) => u.socketId !== user.socketId)
        )
        toast(`${user.username}'s request declined`, { icon: "❌" })
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {pendingUsers.map((user) => (
                <div
                    key={user.socketId}
                    className="flex w-72 items-center gap-3 rounded-lg border border-green-500/30 bg-darkHover p-3 shadow-lg"
                >
                    {/* Avatar */}
                    {user.avatar ? (
                        <img
                            src={user.avatar}
                            alt={user.username}
                            className="h-10 w-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-black">
                            {user.username[0]?.toUpperCase()}
                        </div>
                    )}

                    <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                            {user.username}
                        </p>
                        <p className="text-xs text-gray-400">wants to join</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => approve(user)}
                            className="rounded bg-green-500 px-2 py-1 text-xs font-bold text-black hover:bg-green-400"
                        >
                            ✓
                        </button>
                        <button
                            onClick={() => reject(user)}
                            className="rounded bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/30"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default JoinRequestModal