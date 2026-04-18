import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { RemoteUser, USER_CONNECTION_STATUS, UserRole } from "@/types/user"
import { FaCrown, FaEdit, FaUserLock } from "react-icons/fa"
import { useState, useRef, useEffect } from "react"
import toast from "react-hot-toast"

function Users() {
    const { users, currentUser } = useAppContext()

    return (
        <div className="flex min-h-[200px] flex-grow justify-center overflow-y-auto py-2">
            <div className="flex h-full w-full flex-wrap items-start gap-x-2 gap-y-6">
                {users.map((user) => {
                    return <User key={user.socketId} user={user} isCurrentUserHost={currentUser.role === 'HOST'} />
                })}
            </div>
        </div>
    )
}

const User = ({ user, isCurrentUserHost }: { user: RemoteUser; isCurrentUserHost?: boolean }) => {
    const { username, status, role, socketId, avatar } = user
    const { socket } = useSocket()
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const title = `${username} - ${status === USER_CONNECTION_STATUS.ONLINE ? "online" : "offline"}`

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    const handleUserClick = () => {
        if (isCurrentUserHost && role !== 'HOST') {
            setShowMenu(!showMenu)
        }
    }

    const toggleRole = (newRole: UserRole) => {
        if (!isCurrentUserHost) return
        
        socket.emit("assign-role", {
            targetSocketId: socketId,
            role: newRole
        })
        
        setShowMenu(false)
        toast.success(`Role changed to ${newRole.toLowerCase()}`)
    }

    const kickUser = () => {
        if (!isCurrentUserHost) return
        
        socket.emit("KICK_USER", {
            userSocketId: socketId
        })
        
        setShowMenu(false)
        toast.success(`${username} removed from room`)
    }

    return (
        <div
            className="relative flex w-[100px] flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            title={title}
            onClick={handleUserClick}
            ref={menuRef}
        >
            <div className="relative">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={username}
                        className="h-12 w-12 rounded-full object-cover border-2 border-darkHover shadow-sm"
                        title={username}
                        onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : null}
                
                {/* Initials fallback (shown if no avatar, or if avatar fails to load) */}
                <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg shadow-sm ${avatar ? 'hidden' : ''}`}>
                    {username[0]?.toUpperCase()}
                </div>
                
                {/* Role indicators */}
                {role === 'HOST' && (
                    <FaCrown 
                        className="absolute -top-1 -right-1 text-yellow-400 text-xs"
                        title="Host"
                    />
                )}
                {role === 'EDITOR' && (
                    <FaEdit 
                        className="absolute -top-1 -right-1 text-green-400 text-xs"
                        title="Editor"
                    />
                )}
                {role === 'VIEWER' && (
                    <FaUserLock 
                        className="absolute -top-1 -right-1 text-gray-400 text-xs"
                        title="Viewer"
                    />
                )}
            </div>
            <p className="line-clamp-2 max-w-full text-ellipsis break-words text-center text-xs">
                {username}
            </p>
            <div
                className={`absolute right-5 top-0 h-3 w-3 rounded-full ${
                    status === USER_CONNECTION_STATUS.ONLINE
                        ? "bg-green-500"
                        : "bg-red-500"
                }`}
            ></div>
            
            
            {/* Host controls menu */}
            {showMenu && isCurrentUserHost && role !== 'HOST' && (
                <div className="absolute top-14 z-50 flex flex-col gap-1 rounded bg-dark p-2 shadow-lg border border-gray-700">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleRole(role === 'VIEWER' ? 'EDITOR' : 'VIEWER')
                        }}
                        className="text-xs px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors w-full text-left"
                        title={role === 'VIEWER' ? 'Promote to Editor' : 'Demote to Viewer'}
                    >
                        {role === 'VIEWER' ? 'Promote' : 'Demote'}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            kickUser()
                        }}
                        className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors w-full text-left"
                        title="Remove from room"
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    )
}

export default Users
