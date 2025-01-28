const mongoose = require("mongoose");

const ClickSchema = new mongoose.Schema({
    linkId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Link", // Reference to the Link schema
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User", // Reference to the User schema
    },
    deviceType: {
        type: String,
        required: true,
        
    },
    date: {
        type: Date,
        required: true,
    },
});

module.exports = mongoose.model("Click", ClickSchema);
