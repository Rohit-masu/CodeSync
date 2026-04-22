import Users from "@/components/common/Users"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { USER_STATUS, UserRole } from "@/types/user"
import toast from "react-hot-toast"
import { GoSignOut } from "react-icons/go"
import { IoShareOutline } from "react-icons/io5"
import { LuCopy } from "react-icons/lu"
import { FaChartBar } from "react-icons/fa"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import AnalyticsModal from "@/components/room/AnalyticsModal"

const UsersView = () => {
    const navigate = useNavigate()
    const { viewHeight } = useResponsive()
    const { setStatus, setCurrentUser } = useAppContext()
    const { socket } = useSocket()
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)

    const copyURL = async () => {
        const url = window.location.href
        try {
            await navigator.clipboard.writeText(url)
            toast.success("URL copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy URL to clipboard")
            console.log(error)
        }
    }

    const shareURL = async () => {
        const url = window.location.href
        try {
            await navigator.share({ url })
        } catch (error) {
            toast.error("Unable to share URL")
            console.log(error)
        }
    }

    const leaveRoom = () => {
        // Prevent auto-reconnection
        socket.io.opts.autoConnect = false
        socket.disconnect()
        setStatus(USER_STATUS.DISCONNECTED)
        // Clear current user to prevent rejoin
        setCurrentUser({
            username: "",
            roomId: "",
            role: "VIEWER" as UserRole,
            socketId: "",
        })
        navigate("/", {
            replace: true,
        })
    }

    
    return (
        <div className="flex flex-col p-4" style={{ height: viewHeight }}>
            <h1 className="view-title">Users</h1>
            {/* List of connected users */}
            <Users />
            <div className="flex flex-col items-center gap-4 pt-4">
                <button
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-500/20 p-3 font-semibold text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                    onClick={() => setIsAnalyticsOpen(true)}
                    title="View Analytics"
                >
                    <FaChartBar size={20} />
                    View Analytics
                </button>
                <div className="flex w-full gap-4">
                    {/* Share URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={shareURL}
                        title="Share Link"
                    >
                        <IoShareOutline size={26} />
                    </button>
                    {/* Copy URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={copyURL}
                        title="Copy Link"
                    >
                        <LuCopy size={22} />
                    </button>
                    {/* Leave room button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-primary p-3 text-black"
                        onClick={leaveRoom}
                        title="Leave room"
                    >
                        <GoSignOut size={22} />
                    </button>
                </div>
            </div>
            
            <AnalyticsModal 
                isOpen={isAnalyticsOpen} 
                onClose={() => setIsAnalyticsOpen(false)} 
            />
        </div>
    )
}

export default UsersView
