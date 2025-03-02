const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name:{
        type:String,
      
        required:true
    },
    email:{
        type:String,
        unique:true,
        required:true
    },
    mobile:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    tokenIssuedAt: { 
        type: Number,
        default: Date.now
    }
})

module.exports = mongoose.model('User',userSchema);
