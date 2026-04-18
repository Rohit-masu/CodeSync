import { useAuth } from "@/context/AuthContext"
import { Navigate, useLocation } from "react-router-dom"

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-dark">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}

export default PrivateRoute
