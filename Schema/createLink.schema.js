const mongoose = require("mongoose");

const LinkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },
    destinationUrl: {
        type: String,
        required: true,
    },
    shortUrl: {
        type: String,
        required: true,
        unique: true,
    },
    comments: {
        type: String,
        default: "",
    },
    linkExpiration: {
        type: Boolean,
        default: false,
    },
    expirationDate: {
        type: Date,
    },
    clickCount: {
        type: Number,
        default: 0,  
    },
}, { timestamps: true });

module.exports = mongoose.model("Link", LinkSchema);
