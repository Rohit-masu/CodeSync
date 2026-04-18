import {
    ACTIVITY_STATE,
    AppContext as AppContextType,
    DrawingData,
} from "@/types/app"
import { PendingUser, RemoteUser, USER_STATUS, User, UserRole } from "@/types/user"
import { ReactNode, createContext, useContext, useState } from "react"

const AppContext = createContext<AppContextType | null>(null)

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext)
    if (context === null) {
        throw new Error("useAppContext must be used within a AppContextProvider")
    }
    return context
}

function AppContextProvider({ children }: { children: ReactNode }) {
    const [users, setUsers] = useState<RemoteUser[]>([])
    const [status, setStatus] = useState<USER_STATUS>(USER_STATUS.INITIAL)

    // ── FIX: default role is VIEWER until server confirms HOST/EDITOR ─────────
    const [currentUser, setCurrentUser] = useState<User>({
        username: "",
        roomId: "",
        role: "VIEWER" as UserRole,
        socketId: undefined,
        avatar: undefined,
    })
    const [activityState, setActivityState] = useState<ACTIVITY_STATE>(
        ACTIVITY_STATE.CODING,
    )
    const [drawingData, setDrawingData] = useState<DrawingData>(null)
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])

    return (
        <AppContext.Provider
            value={{
                users,
                setUsers,
                currentUser,
                setCurrentUser,
                status,
                setStatus,
                activityState,
                setActivityState,
                drawingData,
                setDrawingData,
                pendingUsers,
                setPendingUsers,
            }}
        >
            {children}
        </AppContext.Provider>
    )
}

export { AppContextProvider }
export default AppContext