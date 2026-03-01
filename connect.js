const mongoose = require("mongoose")

//connection url
const url = "mongodb://127.0.0.1/venlorent"
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
