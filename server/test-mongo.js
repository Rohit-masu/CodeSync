const mongoose = require('mongoose');

// Test your MongoDB Atlas connection
// Replace with your actual MongoDB Atlas password
const testURI = 'mongodb+srv://rohitgp2049_db_user:S1N6fvPgu6NP0ER8@cluster0.v9vxjls.mongodb.net/?appName=Cluster0';

async function testConnection() {
    try {
        console.log('Testing MongoDB Atlas connection...');
        await mongoose.connect(testURI);
        console.log('✅ MongoDB Atlas connection successful!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ MongoDB Atlas connection failed:', error.message);
    }
}

testConnection();
