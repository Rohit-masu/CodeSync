import SplitterComponent from "@/components/SplitterComponent"
import ConnectionStatusPage from "@/components/connection/ConnectionStatusPage"
import Sidebar from "@/components/sidebar/Sidebar"
import WorkSpace from "@/components/workspace"
import JoinRequestModal from "@/components/room/JoinRequestModal"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { useAuth } from "@/context/AuthContext"
import useFullScreen from "@/hooks/useFullScreen"
import useUserActivity from "@/hooks/useUserActivity"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS, User } from "@/types/user"
import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

function EditorPage() {
    useUserActivity()
    useFullScreen()

    const navigate = useNavigate()
    const { roomId } = useParams()
    const { status, setStatus, setCurrentUser, currentUser } = useAppContext()
    const { socket } = useSocket()
    const { authUser, isAuthenticated } = useAuth()
    const location = useLocation()

    useEffect(() => {
        // If we already have a username set and status is JOINED, don't do anything
        if (currentUser.username.length > 0 && status === USER_STATUS.JOINED) return

        // Get username from authenticated user or location state
        let username = location.state?.username
        if (!username && isAuthenticated && authUser) {
            username = authUser.username
        }

        if (!username || status === USER_STATUS.DISCONNECTED) {
            navigate("/", { state: { roomId } })
        } else if (roomId && status !== USER_STATUS.JOINED && status !== USER_STATUS.ATTEMPTING_JOIN) {
            const user: User = { username, roomId, role: "VIEWER" }
            setCurrentUser(user)
            setStatus(USER_STATUS.ATTEMPTING_JOIN)
            socket.emit(SocketEvent.JOIN_REQUEST, { roomId })
        }
    }, [
        currentUser.username,
        location.state?.username,
        authUser,
        isAuthenticated,
        navigate,
        roomId,
        setCurrentUser,
        setStatus,
        socket,
        status,
    ])

    if (status === USER_STATUS.CONNECTION_FAILED) {
        return <ConnectionStatusPage />
    }

    if (status === USER_STATUS.DISCONNECTED || status === USER_STATUS.INITIAL || status === USER_STATUS.ATTEMPTING_JOIN) {
        return (
            <div className="flex h-screen items-center justify-center bg-dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-lg text-white">
                        {status === USER_STATUS.ATTEMPTING_JOIN 
                            ? "Waiting for host approval..." 
                            : "Connecting to room..."}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            <SplitterComponent>
                <Sidebar />
                <WorkSpace />
            </SplitterComponent>
            {/* Host sees pending join requests as floating cards */}
            <JoinRequestModal />
        </>
    )
}

export default EditorPage