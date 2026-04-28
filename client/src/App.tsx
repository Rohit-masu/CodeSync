import { Route, BrowserRouter as Router, Routes } from "react-router-dom"
import GitHubCorner from "./components/GitHubCorner"
import Toast from "./components/toast/Toast"
import PrivateRoute from "./components/auth/PrivateRoute"
import EditorPage from "./pages/EditorPage"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ProfilePage from "./pages/ProfilePage"
import OAuthSuccessPage from "./pages/OAuthSuccessPage"

const App = () => {
    return (
        <>
            <Router>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/auth/success" element={<OAuthSuccessPage />} />

                    {/* Semi-protected — shows auth status but accessible */}
                    <Route path="/" element={<HomePage />} />

                    {/* Protected routes */}
                    <Route
                        path="/profile"
                        element={
                            <PrivateRoute>
                                <ProfilePage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/editor/:roomId"
                        element={
                            <PrivateRoute>
                                <EditorPage />
                            </PrivateRoute>
                        }
                    />
                </Routes>
            </Router>
            <Toast />
            <GitHubCorner />
        </>
    )
}

export default App
