import { ChatContext as ChatContextType, ChatMessage } from "@/types/chat"
import { SocketEvent } from "@/types/socket"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import { useSocket } from "./SocketContext"

const ChatContext = createContext<ChatContextType | null>(null)

export const useChatRoom = (): ChatContextType => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error("useChatRoom must be used within a ChatContextProvider")
    }
    return context
}

function ChatContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isNewMessage, setIsNewMessage] = useState<boolean>(false)
    const [lastScrollHeight, setLastScrollHeight] = useState<number>(0)

    useEffect(() => {
        socket.on(
            SocketEvent.RECEIVE_MESSAGE,
            ({ message }: { message: any }) => {
                const formattedMessage: ChatMessage = {
                    id: message.id || Math.random().toString(),
                    message: message.content || message.message || "",
                    username: message.username || "Unknown",
                    timestamp: message.timestamp 
                        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                setMessages((messages) => [...messages, formattedMessage])
                setIsNewMessage(true)
            },
        )
        
        socket.on(SocketEvent.JOIN_ACCEPTED, ({ recentMessages }: { recentMessages: any[] }) => {
            if (recentMessages && Array.isArray(recentMessages)) {
                // Map the server messages to ChatMessage format if needed
                const formattedMessages = recentMessages.map((m: any) => ({
                    id: m.id || Math.random().toString(),
                    message: m.content || m.message || "",
                    username: m.username || "Unknown",
                    timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }))
                setMessages(formattedMessages)
            }
        })
        
        return () => {
            socket.off(SocketEvent.RECEIVE_MESSAGE)
            socket.off(SocketEvent.JOIN_ACCEPTED)
        }
    }, [socket])

    return (
        <ChatContext.Provider
            value={{
                messages,
                setMessages,
                isNewMessage,
                setIsNewMessage,
                lastScrollHeight,
                setLastScrollHeight,
            }}
        >
            {children}
        </ChatContext.Provider>
    )
}

export { ChatContextProvider }
export default ChatContext
