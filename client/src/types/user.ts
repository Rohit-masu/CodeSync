enum USER_CONNECTION_STATUS {
    OFFLINE = "offline",
    ONLINE = "online",
}

export type UserRole = 'HOST' | 'EDITOR' | 'VIEWER'

interface User {
    username: string
    roomId: string
    role: UserRole
    avatar?: string
    socketId?: string
}

interface RemoteUser extends User {
    status: USER_CONNECTION_STATUS
    cursorPosition: number
    typing: boolean
    currentFile: string
    selectionStart?: number
    selectionEnd?: number
}

enum USER_STATUS {
    INITIAL = "initial",
    CONNECTING = "connecting",
    ATTEMPTING_JOIN = "attempting-join",
    JOINED = "joined",
    CONNECTION_FAILED = "connection-failed",
    DISCONNECTED = "disconnected",
}

// ─── Auth types (new) ─────────────────────────────────────────────────────────
interface AuthUser {
    id: string
    username: string
    email: string
    avatar: string | null
}

interface PendingUser {
    socketId: string
    username: string
    avatar: string | null
}

export {
    USER_CONNECTION_STATUS,
    USER_STATUS,
    RemoteUser,
    User,
    AuthUser,
    PendingUser,
}
