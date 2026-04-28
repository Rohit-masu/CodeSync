export function formatDate(timestamp: string) {
    if (!timestamp) {
        return new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        })
    }

    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
        return timestamp
    }

    // Get hours and minutes
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, "0")

    // Determine AM or PM
    const amOrPm = hours >= 12 ? "PM" : "AM"

    // Convert to 12-hour format
    hours = hours % 12
    hours = hours ? hours : 12 // Handle midnight

    // Format the date string
    const formattedTime = `${hours}:${minutes} ${amOrPm}`

    return formattedTime
}
