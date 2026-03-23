import { ICopilotContext } from "@/types/copilot"
import { createContext, ReactNode, useContext, useState } from "react"
import toast from "react-hot-toast"
import axiosInstance from "../api/copilotApi"

const CopilotContext = createContext<ICopilotContext | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useCopilot = () => {
    const context = useContext(CopilotContext)
    if (context === null) {
        throw new Error(
            "useCopilot must be used within a CopilotContextProvider",
        )
    }
    return context
}

const CopilotContextProvider = ({ children }: { children: ReactNode }) => {
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)

    const generateCode = async () => {
        try {
            if (input.length === 0) {
                toast.error("Please write a prompt")
                return
            }

            toast.loading("Generating code...")
            setIsRunning(true)
            const response = await axiosInstance.post("/api/copilot", {
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a code generator copilot for project named Code Sync. Generate code based on given prompt without any explanation. Return only the code, formatted in Markdown using the appropriate language syntax (e.g., js for JavaScript, py for Python). Do not include any additional text or explanations. If you don't know the answer, respond with 'I don't know'.",
                    },
                    {
                        role: "user",
                        content: input,
                    },
                ],
                model: "llama-3.3-70b-versatile",
            })
            if (response.data) {
                toast.success("Code generated successfully")
                console.log("API Response:", response.data)
                const content = response.data.choices?.[0]?.message?.content
                if (content) {
                    setOutput(content)
                } else {
                    console.error("No content found in response")
                    toast.error("No content generated")
                }
            } else {
                console.error("No response data received")
                toast.error("No response received")
            }
            setIsRunning(false)
            toast.dismiss()
        } catch (error) {
            console.error(error)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to generate the code")
        }
    }

    return (
        <CopilotContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                generateCode,
            }}
        >
            {children}
        </CopilotContext.Provider>
    )
}

export { CopilotContextProvider }
export default CopilotContext
