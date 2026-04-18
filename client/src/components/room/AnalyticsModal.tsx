import { useEffect, useState } from "react"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { IoClose } from "react-icons/io5"
import { FaChartBar, FaClock, FaCode, FaFileAlt } from "react-icons/fa"

interface AnalyticsModalProps {
    isOpen: boolean
    onClose: () => void
}

interface UserMetrics {
    username: string
    filesCreated: number
    filesEdited: number
    linesAdded: number
    linesDeleted: number
    totalEditTime: number
    lastActivityAt: string
}

interface ProjectEstimate {
    totalLOC: number
    fileCount: number
    avgVelocity: number
    complexityFactor: string
    estimationHours: number
}

interface AnalyticsData {
    users: UserMetrics[]
    projectEstimate: ProjectEstimate
}

const AnalyticsModal = ({ isOpen, onClose }: AnalyticsModalProps) => {
    const { socket } = useSocket()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isOpen) return

        setLoading(true)
        socket.emit(SocketEvent.REQUEST_METRICS)

        const handleMetrics = (analytics: AnalyticsData) => {
            setData(analytics)
            setLoading(false)
        }

        socket.on(SocketEvent.USER_METRICS, handleMetrics)

        // Refresh every 5 seconds while open
        const interval = setInterval(() => {
            socket.emit(SocketEvent.REQUEST_METRICS)
        }, 5000)

        return () => {
            socket.off(SocketEvent.USER_METRICS, handleMetrics)
            clearInterval(interval)
        }
    }, [isOpen, socket])

    if (!isOpen) return null

    const formatTime = (ms: number) => {
        if (ms < 60000) return `${Math.floor(ms / 1000)}s`
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-4xl flex-col rounded-xl border border-gray-700 bg-dark shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-700 p-5">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                        <FaChartBar className="text-primary" />
                        Project Analytics & Estimation
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                    >
                        <IoClose size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading && !data ? (
                        <div className="flex h-40 items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                        </div>
                    ) : !data ? (
                        <div className="text-center text-gray-400">Failed to load analytics data.</div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* Project Estimate Section */}
                            <section>
                                <h3 className="mb-4 text-lg font-semibold text-gray-300">Project Estimation</h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="rounded-lg border border-gray-700 bg-darkHover p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <FaCode /> Total LOC
                                        </div>
                                        <div className="mt-1 text-2xl font-bold text-white">{data.projectEstimate.totalLOC}</div>
                                    </div>
                                    <div className="rounded-lg border border-gray-700 bg-darkHover p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <FaFileAlt /> Total Files
                                        </div>
                                        <div className="mt-1 text-2xl font-bold text-white">{data.projectEstimate.fileCount}</div>
                                    </div>
                                    <div className="rounded-lg border border-gray-700 bg-darkHover p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <FaChartBar /> Avg Velocity
                                        </div>
                                        <div className="mt-1 text-2xl font-bold text-white">
                                            {data.projectEstimate.avgVelocity} <span className="text-sm font-normal text-gray-500">lines/hr</span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                                        <div className="flex items-center gap-2 text-sm text-green-400">
                                            <FaClock /> Est. Time to Complete
                                        </div>
                                        <div className="mt-1 text-2xl font-bold text-white">
                                            {data.projectEstimate.estimationHours} <span className="text-sm font-normal text-green-500">hours</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Complexity: {data.projectEstimate.complexityFactor}x</div>
                                    </div>
                                </div>
                            </section>

                            {/* User Contributions Section */}
                            <section>
                                <h3 className="mb-4 text-lg font-semibold text-gray-300">User Contributions</h3>
                                {data.users.length === 0 ? (
                                    <div className="rounded-lg border border-gray-700 p-8 text-center text-gray-400">
                                        No contribution data yet. Start typing to see stats!
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {data.users.map((user) => (
                                            <div key={user.username} className="flex flex-col rounded-lg border border-gray-700 bg-darkHover p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <span className="font-bold text-white">{user.username}</span>
                                                    <span className="text-xs text-gray-500">
                                                        Active: {new Date(user.lastActivityAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="flex justify-between rounded bg-dark p-2">
                                                        <span className="text-gray-400">Files Authored</span>
                                                        <span className="font-medium text-white">{user.filesCreated}</span>
                                                    </div>
                                                    <div className="flex justify-between rounded bg-dark p-2">
                                                        <span className="text-gray-400">Files Edited</span>
                                                        <span className="font-medium text-white">{user.filesEdited}</span>
                                                    </div>
                                                    <div className="flex justify-between rounded bg-green-500/10 p-2 text-green-400">
                                                        <span>Lines Added</span>
                                                        <span className="font-medium">+{user.linesAdded}</span>
                                                    </div>
                                                    <div className="flex justify-between rounded bg-red-500/10 p-2 text-red-400">
                                                        <span>Lines Deleted</span>
                                                        <span className="font-medium">-{user.linesDeleted}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                                    <FaClock /> Total Active Edit Time: {formatTime(user.totalEditTime)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AnalyticsModal