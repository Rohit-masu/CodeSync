import { useAuth } from "@/context/AuthContext"
import { useEffect } from "react"
import { toast } from "react-hot-toast"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function OAuthSuccessPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { completeOAuth } = useAuth()

    useEffect(() => {
        const token = searchParams.get("token")
        const username = searchParams.get("username")

        const finalizeOAuth = async () => {
            if (!token) {
                toast.error("Authentication failed")
                navigate("/login", { replace: true })
                return
            }

            try {
                await completeOAuth(token)
                toast.success(username ? `Welcome ${username}!` : "Welcome!")
                navigate("/", { replace: true })
            } catch {
                localStorage.removeItem("token")
                toast.error("Authentication failed")
                navigate("/login", { replace: true })
            }
        }

        finalizeOAuth()
    }, [completeOAuth, navigate, searchParams])

    return (
        <div className="flex min-h-screen items-center justify-center bg-dark">
            <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
                <p className="text-white">Completing authentication...</p>
            </div>
        </div>
    )
}
