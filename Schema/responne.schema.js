const mongoose = require("mongoose");

const ClickDetailsSchema = new mongoose.Schema({
    userId: { // The user who created the link
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },
    originalLink: { // The original destination URL
        type: String,
        required: true,
    },
    shortLink: { // The shortened URL
        type: String,
        required: true,
    },
    date: { // Date and time when the link was clicked
        type: Date,
        default: Date.now,
    },
    ipAddress: { // IP address of the device that clicked the link
        type: String,
        required: true,
    },
    deviceInfo: { // Browser and device information
        type: String,
        required: true,
    },
});

module.exports = mongoose.model("ClickDetails", ClickDetailsSchema);
