import express from "express"
import axios from "axios"

const router = express.Router()

// Proxy endpoint for Hugging Face API to avoid CORS issues
router.post("/suggest", async (req, res) => {
    const { language, code, cursorPosition } = req.body
    
    try {
        
        console.log("AI suggestion request:", { language, codeLength: code?.length, cursorPosition })
        
        const AI_API_URL = "https://api-inference.huggingface.co/models/bigcode/starcoderbase"
        
        if (!process.env.HUGGING_FACE_API_KEY) {
            console.error("HUGGING_FACE_API_KEY not configured")
            return res.status(500).json({ 
                error: "Hugging Face API key not configured on server",
                details: "Please set HUGGING_FACE_API_KEY in server .env file"
            })
        }
        
        // Extract context around cursor
        const lines = code.split('\n')
        let currentLine = 0
        let charCount = 0
        
        for (let i = 0; i < lines.length; i++) {
            if (charCount + lines[i].length + 1 > cursorPosition) {
                currentLine = i
                break
            }
            charCount += lines[i].length + 1
        }
        
        // Get context (previous 10 lines and current line up to cursor)
        const startLine = Math.max(0, currentLine - 10)
        const contextLines = lines.slice(startLine, currentLine + 1)
        const context = contextLines.join('\n')
        
        const getFileExtension = (lang: string): string => {
            const extensions: { [key: string]: string } = {
                javascript: "js",
                typescript: "ts",
                python: "py",
                java: "java",
                cpp: "cpp",
                c: "c",
                csharp: "cs",
                php: "php",
                ruby: "rb",
                go: "go",
                rust: "rs",
                sql: "sql",
                html: "html",
                css: "css",
                json: "json",
            }
            return extensions[lang.toLowerCase()] || "txt"
        }
        
        const prompt = `<|file_name|>temp.${getFileExtension(language)}\n<|file_content|>${context}\n<|fim_prefix|>${context}<|fim_suffix|><|fim_middle|>`
        
        const response = await axios.post(AI_API_URL, {
            inputs: prompt,
            parameters: {
                max_new_tokens: 100,
                temperature: 0.2,
                return_full_text: false,
                stop: ["<|file_content|>", "\n\n\n"],
            },
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
                "Content-Type": "application/json",
            },
        })
        
        const suggestion = response.data[0]?.generated_text || ""
        const cleanedSuggestion = suggestion
            .replace(/<\|.*?\|>/g, "")
            .trim()
            .split('\n')[0] // Only return the first line of the suggestion
        
        res.json({ suggestion: cleanedSuggestion })
        
    } catch (error: any) {
        console.error("Hugging Face AI suggestion error:", error)
        
        // Try GROQ as fallback
        try {
            const { default: OpenAI } = await import("openai")
            const groq = new OpenAI({
                apiKey: process.env.GROQ_API_KEY,
                baseURL: "https://api.groq.com/openai/v1"
            })
            
            const prompt = `Provide a single line of code completion for this ${language} code:\n\n${code.substring(Math.max(0, cursorPosition - 100), cursorPosition)}\n\nOnly return the code completion, no explanation:`
            
            const groqResponse = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 50,
                temperature: 0.2
            })
            
            const suggestion = groqResponse.choices[0]?.message?.content?.trim() || ""
            res.json({ suggestion })
            return
            
        } catch (groqError: any) {
            console.error("GROQ fallback also failed:", groqError)
            
            res.status(500).json({ 
                error: "Failed to generate AI suggestion", 
                details: `Hugging Face: ${error?.response?.data || error?.message}. GROQ: ${groqError?.message}` 
            })
        }
    }
})

export default router
