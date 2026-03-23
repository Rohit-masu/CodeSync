import axios, { AxiosInstance } from "axios"

const pollinationsBaseUrl = "https://text.pollinations.ai"
const apiKey = import.meta.env.VITE_POLLINATIONS_API_KEY

const instance: AxiosInstance = axios.create({
    baseURL: pollinationsBaseUrl,
    headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "Authorization": `Bearer ${apiKey}` }),
    },
})

export default instance
