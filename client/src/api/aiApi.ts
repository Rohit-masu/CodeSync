import axios from "axios"

const AI_API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const aiInstance = axios.create({
    baseURL: AI_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
})

export const generateCodeSuggestion = async (
    language: string,
    code: string,
    cursorPosition: number
): Promise<string> => {
    try {
        const response = await aiInstance.post('/api/ai/suggest', {
            language,
            code,
            cursorPosition
        })
        
        return response.data.suggestion || ""
        
    } catch (error: any) {
        console.error("AI suggestion error:", error)
        throw new Error(`Failed to generate AI suggestion: ${error.message}`)
    }
}

export default aiInstance
