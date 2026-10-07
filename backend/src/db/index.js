import mongoose from "mongoose"
import dotenv from 'dotenv'
const dbname = 'hello';


dotenv.config({
    path: "./.env"
})


async function connectdb() {
    try {
        const connectionInstance= await mongoose.connect(`${process.env.MONGODB_URI}/${dbname}`);
        console.log(`${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("error connecting to db", error);
        process.exit(1);
    }
}
export {connectdb};