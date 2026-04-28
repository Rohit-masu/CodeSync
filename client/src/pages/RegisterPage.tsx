import logo from "@/assets/logo.svg"
import { useAuth } from "@/context/AuthContext"
import { FormEvent, useState } from "react"
import { toast } from "react-hot-toast"
import { FiArrowLeft, FiLock, FiMail, FiUser } from "react-icons/fi"
import { Link, useNavigate } from "react-router-dom"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

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
        <div className="min-h-screen bg-dark px-4 py-6 text-white">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(57,224,121,0.18),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0.01))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
                    <button
                        onClick={() => navigate("/")}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-primary/40 hover:text-white"
                    >
                        <FiArrowLeft />
                        Home
                    </button>
                    <div className="mt-8">
                        <img src={logo} alt="CodeSync" className="w-44 sm:w-48" />
                        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-primary">Create your account</p>
                        <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                            Get your CodeSync identity ready before you invite anyone into the room.
                        </h1>
                        <p className="mt-4 max-w-lg text-sm leading-6 text-gray-300">
                            Register once, then create rooms, share links, update your avatar, and manage everything from the same workspace.
                        </p>
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Quick setup</p>
                                <p className="mt-2 text-sm text-gray-200">Create an account in under a minute and start a room immediately.</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Demo friendly</p>
                                <p className="mt-2 text-sm text-gray-200">Perfect for project defense, teamwork demos, and collaborative coding sessions.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(61,64,74,0.98),rgba(33,36,41,0.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-8">
                    <h2 className="text-2xl font-bold text-white">Create account</h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Set up your account to host rooms, collaborate, and keep your profile synced.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                                <FiUser className="text-primary" />
                                Username
                            </label>
                            <input
                                type="text"
                                placeholder="coolcoder42"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white placeholder-gray-500 focus:border-primary/60 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                                <FiMail className="text-primary" />
                                Email
                            </label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white placeholder-gray-500 focus:border-primary/60 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                                <FiLock className="text-primary" />
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white placeholder-gray-500 focus:border-primary/60 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                                <FiLock className="text-primary" />
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                placeholder="Repeat your password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-white placeholder-gray-500 focus:border-primary/60 focus:outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 w-full rounded-xl bg-primary py-3 text-lg font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                        >
                            {loading ? "Creating account..." : "Register"}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center">
                        <div className="h-px w-full bg-white/10"></div>
                        <span className="px-4 text-sm text-gray-500">OR</span>
                        <div className="h-px w-full bg-white/10"></div>
                    </div>

                    <button
                        type="button"
                        onClick={() => window.location.href = `${BACKEND_URL}/auth/google`}
                        className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-dark px-4 py-3 text-white transition hover:border-primary/40 hover:bg-white/5"
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
        </div>
    )
}

export default RegisterPage
