import { AuthUser } from "@/types/user"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"
import axios from "axios"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

interface AuthContextType {
    authUser: AuthUser | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (username: string, email: string, password: string) => Promise<void>
    logout: () => void
    updateProfile: (username: string) => Promise<void>
    updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
    uploadAvatar: (file: File) => Promise<void>
    deleteAvatar: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (!context) throw new Error("useAuth must be used within AuthProvider")
    return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [authUser, setAuthUser] = useState<AuthUser | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const isAuthenticated = !!authUser && !!token

    const authAxios = useCallback(
        (t?: string) =>
            axios.create({
                baseURL: BACKEND_URL,
                headers: { Authorization: `Bearer ${t ?? token}` },
            }),
        [token],
    )

    // ── Load user on mount ────────────────────────────────────────────────────
    // NO redirects here — just silently clear bad token
    // PrivateRoute handles the redirect to /login
    useEffect(() => {
        const loadUser = async () => {
            const savedToken = localStorage.getItem("token")
            if (!savedToken) {
                setIsLoading(false)
                return
            }
            try {
                const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${savedToken}` },
                })
                setAuthUser(res.data)
                setToken(savedToken)
            } catch {
                // Silently clear — no toast, no redirect
                // PrivateRoute will handle sending to /login if needed
                localStorage.removeItem("token")
                setToken(null)
                setAuthUser(null)
            } finally {
                setIsLoading(false)
            }
        }
        loadUser()
    }, [])

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (email: string, password: string) => {
        const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
            email,
            password,
        })
        const { token: newToken, user } = res.data
        localStorage.setItem("token", newToken)
        setToken(newToken)
        setAuthUser(user)
    }

    // ── Register ──────────────────────────────────────────────────────────────
    const register = async (
        username: string,
        email: string,
        password: string,
    ) => {
        const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
            username,
            email,
            password,
        })
        const { token: newToken, user } = res.data
        localStorage.setItem("token", newToken)
        setToken(newToken)
        setAuthUser(user)
    }

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem("token")
        setToken(null)
        setAuthUser(null)
    }, [])

    // ── Update profile ────────────────────────────────────────────────────────
    const updateProfile = async (username: string) => {
        const res = await authAxios().put("/api/auth/profile", { username })
        const { token: newToken, user } = res.data
        localStorage.setItem("token", newToken)
        setToken(newToken)
        setAuthUser(user)
    }

    // ── Update password ───────────────────────────────────────────────────────
    const updatePassword = async (
        currentPassword: string,
        newPassword: string,
    ) => {
        await authAxios().put("/api/auth/password", {
            currentPassword,
            newPassword,
        })
    }

    // ── Upload avatar ─────────────────────────────────────────────────────────
    const uploadAvatar = async (file: File) => {
        const formData = new FormData()
        formData.append("avatar", file)
        const res = await authAxios().post("/api/avatar", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        setAuthUser((prev) =>
            prev ? { ...prev, avatar: res.data.avatar } : prev,
        )
    }

    // ── Delete avatar ─────────────────────────────────────────────────────────
    const deleteAvatar = async () => {
        await authAxios().delete("/api/avatar")
        setAuthUser((prev) => (prev ? { ...prev, avatar: null } : prev))
    }

    return (
        <AuthContext.Provider
            value={{
                authUser,
                token,
                isAuthenticated,
                isLoading,
                login,
                register,
                logout,
                updateProfile,
                updatePassword,
                uploadAvatar,
                deleteAvatar,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext