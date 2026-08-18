const mongoose = require("mongoose")

//connection url
const url = process.env.MONGODB_URL
const connectDB = async () => {
    try{
        await mongoose.connect(url)
        console.log("Database connected successfuly")
    }catch(err){
        console.log("Database connection failed:", err)
        // Re-throw so server startup can fail fast instead of running half-connected.
        throw err
    }
}
module.exports = connectDB
