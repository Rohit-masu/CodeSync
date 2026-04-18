import { useAuth } from "@/context/AuthContext"
import { FormEvent, useState } from "react"
import { toast } from "react-hot-toast"
import { Link, useNavigate } from "react-router-dom"
import logo from "@/assets/logo.svg"

const RegisterPage = () => {
    const navigate = useNavigate()
    const { register } = useAuth()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!username || !email || !password || !confirm) {
            toast.error("Please fill in all fields")
            return
        }
        if (password !== confirm) {
            toast.error("Passwords do not match")
            return
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters")
            return
        }
        setLoading(true)
        try {
            await register(username, email, password)
            toast.success("Account created!")
            navigate("/")
        } catch (err: any) {
            toast.error(err?.response?.data?.error || "Registration failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-dark px-4">
            <div className="w-full max-w-md rounded-xl border border-gray-700 bg-darkHover p-8 shadow-2xl">
                <div className="mb-8 flex justify-center">
                    <img src={logo} alt="CodeSync" className="w-48" />
                </div>

                <h2 className="mb-6 text-center text-2xl font-bold text-white">
                    Create account
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">Username</label>
                        <input
                            type="text"
                            placeholder="coolcoder42"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-md border border-gray-600 bg-dark px-3 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md border border-gray-600 bg-dark px-3 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-md border border-gray-600 bg-dark px-3 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full rounded-md border border-gray-600 bg-dark px-3 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full rounded-md bg-primary py-3 text-lg font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? "Creating account..." : "Register"}
                    </button>
                </form>

                <div className="mt-6 flex items-center justify-center">
                    <div className="h-px w-full bg-gray-700"></div>
                    <span className="px-4 text-sm text-gray-500">OR</span>
                    <div className="h-px w-full bg-gray-700"></div>
                </div>

                <button
                    type="button"
                    onClick={() => toast("Google OAuth integration to be implemented!")}
                    className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-gray-600 bg-dark px-4 py-3 text-white transition hover:bg-gray-800"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                </button>

                <p className="mt-6 text-center text-sm text-gray-400">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="text-green-400 underline hover:text-green-300"
                    >
                        Login
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default RegisterPage
