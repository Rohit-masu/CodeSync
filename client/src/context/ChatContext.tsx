import { ChatContext as ChatContextType, ChatMessage } from "@/types/chat"
import { SocketEvent } from "@/types/socket"
import { formatDate } from "@/utils/formateDate"
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

    const toChatMessage = (message: any): ChatMessage => ({
        id: message.id || Math.random().toString(),
        message: message.content || message.message || "",
        username: message.username || "Unknown",
        timestamp: formatDate(
            message.timestamp || message.createdAt || new Date().toISOString(),
        ),
    })

    useEffect(() => {
        socket.on(
            SocketEvent.RECEIVE_MESSAGE,
            ({ message }: { message: any }) => {
                const formattedMessage = toChatMessage(message)
                setMessages((messages) => [...messages, formattedMessage])
                setIsNewMessage(true)
            },
        )
        
        socket.on(SocketEvent.JOIN_ACCEPTED, ({ recentMessages }: { recentMessages: any[] }) => {
            if (recentMessages && Array.isArray(recentMessages)) {
                const formattedMessages = recentMessages.map(toChatMessage)
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
