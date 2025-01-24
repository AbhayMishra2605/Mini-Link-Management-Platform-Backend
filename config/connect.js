const mongoose= require('mongoose')
require('dotenv').config();


async function db() {
    mongoose.connect(process.env.DATABASE_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
}


module.exports= db;