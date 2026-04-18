import { useEffect } from "react"
import screenfull from "screenfull"

function useFullScreen() {
    function detectMob() {
        const toMatch = [
            /Android/i,
            /webOS/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /BlackBerry/i,
            /Windows Phone/i,
        ]

        return toMatch.some((toMatchItem) => {
            return navigator.userAgent.match(toMatchItem)
        })
    }
    const isMobile = detectMob()

    useEffect(() => {
        if (!isMobile) return

        if (screenfull.isEnabled) {
            // Only request fullscreen if there's a user interaction
            // Add click handler to request fullscreen on first user click
            const handleFirstClick = () => {
                try {
                    screenfull.request().catch(err => {
                        console.log('Fullscreen request failed:', err)
                    })
                    document.removeEventListener('click', handleFirstClick)
                } catch (error) {
                    console.log('Fullscreen error:', error)
                }
            }
            
            document.addEventListener('click', handleFirstClick, { once: true })
        }
    }, [isMobile])
}

export default useFullScreen
