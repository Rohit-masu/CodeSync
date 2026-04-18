import mongoose from "mongoose"

const MONGODB_URI =
	process.env.MONGODB_URI || "mongodb://localhost:27017/codecollab"

let isConnected = false

async function connectDatabase(): Promise<void> {
	if (isConnected) {
		console.log("Using existing database connection")
		return
	}

	try {
		await mongoose.connect(MONGODB_URI, {
			// Recommended options for production
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000,
			socketTimeoutMS: 45000,
		})

		isConnected = true
		console.log(`MongoDB connected: ${mongoose.connection.host}`)
	} catch (error) {
		console.error("MongoDB connection error:", error)
		process.exit(1)
	}
}

// Graceful shutdown
process.on("SIGINT", async () => {
	await mongoose.connection.close()
	console.log("MongoDB connection closed due to app termination")
	process.exit(0)
})

mongoose.connection.on("disconnected", () => {
	console.warn("MongoDB disconnected. Attempting to reconnect...")
	isConnected = false
})

mongoose.connection.on("reconnected", () => {
	console.log("MongoDB reconnected")
	isConnected = true
})

export { connectDatabase }