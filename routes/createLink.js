const express = require("express");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const Link = require("../Schema/createLink.schema");
const authMiddleware = require('../Middlewares/auth');
const Click = require("../Schema/click.schema");
const { default: mongoose } = require("mongoose");
const ClickDetails =require("../Schema/responne.schema")
const router = express.Router();


router.post("/createlink", authMiddleware, async (req, res) => {
    try {
        const { destinationUrl, comments, linkExpiration, expirationDate } = req.body;

        if (!destinationUrl) {
            return res.status(400).json({ error: "Destination URL is mandatory." });
        }

        if (linkExpiration && expirationDate) {
            const currentDate = new Date();
            const expDate = new Date(expirationDate);
            if (expDate < currentDate) {
                return res.status(400).json({ error: "Expiration date must be in the future." });
            }
        }
        let formattedExpirationDate = null;
        if (expirationDate) {
            const now = new Date(expirationDate); // Convert input to Date object
            const options = {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            };
            const formattedDate = new Intl.DateTimeFormat('en-GB', options).format(now);
            const [day, month, year, hour, minute] = formattedDate.match(/\d+/g);

            formattedExpirationDate = `${year}-${month}-${day}T${hour}:${minute}`;
        }

        const shortUrlCode = shortid.generate();
        const shortUrl = `${req.protocol}://${req.get("host")}/${shortUrlCode}`;

        const newLink = new Link({
            userId: req.user.id,
            destinationUrl,
            shortUrl,
            comments,
            linkExpiration,
            expirationDate: linkExpiration ? formattedExpirationDate  : null,
        });

        await newLink.save();
        res.status(201).json({ message: "Link created successfully", link: newLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});




router.get("/:shortUrlCode", async (req, res) => {
    try {
        const { shortUrlCode } = req.params;

        const link = await Link.findOne({ shortUrl: `${req.protocol}://${req.get("host")}/${shortUrlCode}` });

        if (!link) {
            return res.status(404).json({ error: "Short URL not found." });
        }

        if (link.linkExpiration && link.expirationDate < new Date()) {
            return res.status(410).json({ error: "Link has expired." });
        }

        link.clickCount += 1;
        await link.save();
         // Track the click event
         const deviceType = req.get("User-Agent").includes("Mobile") ? "mobile" : 
         req.get("User-Agent").includes("Tablet") ? "tablet" : "desktop";


const newClick = new Click({
linkId: link._id,
userId: link.userId,
deviceType,
date: new Date(),

});
    

await newClick.save();

        // Extract device and IP information
        const ipAddress = (req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim();
        
        const userAgent = req.get("User-Agent");

        const deviceInfo = userAgent.includes("Mobile") ? "mobile" : 
                           userAgent.includes("Tablet") ? "tablet" : 
                           userAgent.includes("Android") ? "android" : 
                           userAgent.includes("iOS") ? "ios" : 
                           "desktop";

        const newClickDetail = new ClickDetails({
            userId: link.userId,
            originalLink: link.destinationUrl,
            shortLink: link.shortUrl,
            ipAddress,
            deviceInfo: `${deviceInfo} (${userAgent})`,
        });

        await newClickDetail.save();

        res.redirect(link.destinationUrl);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});


// DELETE: Delete a link by ID
router.delete("/deletelink/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const link = await Link.findOneAndDelete({ _id: id, userId: req.user.id });

        if (!link) {
            return res.status(404).json({ error: "Link not found or you do not have permission to delete it." });
        }

        res.status(200).json({ message: "Link deleted successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// PUT: Edit a link by ID
router.put("/editlink/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { destinationUrl, comments, linkExpiration, expirationDate } = req.body;

        // Check if the expiration date is still valid
        let updatedExpirationDate = expirationDate;
        if (linkExpiration && expirationDate) {
            updatedExpirationDate = new Date(expirationDate);
        }

        const shortUrlCode = shortid.generate();
        const shortUrl = `${req.protocol}://${req.get("host")}/${shortUrlCode}`;

        const updatedLink = await Link.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            {
                destinationUrl,
                comments,
                linkExpiration,
                expirationDate: linkExpiration ? updatedExpirationDate : null,
                shortUrl, // Optionally update the short URL
            },
            { new: true }
        );

        if (!updatedLink) {
            return res.status(404).json({ error: "Link not found or you do not have permission to edit it." });
        }

        // Re-check expiration status
        if (updatedLink.linkExpiration && updatedLink.expirationDate < new Date()) {
            return res.status(410).json({ error: "Link has expired." });
        }

        res.status(200).json({ message: "Link updated successfully.", link: updatedLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// GET: Retrieve all links for the current user
router.get("/userlinks/data", authMiddleware, async (req, res) => {
    try {
        // Extract the page and limit from the query parameters
        const { page = 1, limit = 10 } = req.query;

        // Convert page and limit to integers
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        // Calculate the number of documents to skip
        const skip = (pageNum - 1) * limitNum;

        // Fetch the links with pagination
        const links = await Link.find({ userId: req.user.id })
            .skip(skip)
            .limit(limitNum);

        // Transform the data to include only the required fields
        const transformedLinks = links.map((link) => {
            // Format the updatedAt field
            const formattedUpdatedAt = new Date(link.updatedAt).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });

           
           

            return {
                _id: link._id,
                updatedAt: formattedUpdatedAt,
                destinationUrl: link.destinationUrl,
                shortUrl: link.shortUrl,
                comments: link.comments,
                clickCount: link.clickCount,
                linkExpiration: link.linkExpiration,
                linkExpirationDate: link.expirationDate,
            };
        });
        const totalLinks = await Link.countDocuments({ userId: req.user.id });
        const totalPages = Math.ceil(totalLinks / limitNum);

        // Send the response with the transformed links
        res.status(200).json({links:transformedLinks,
            totalLinks,
            totalPages,
            currentPage: pageNum,
            limit: limitNum});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});



//get the data based on comments 
router.get("/userlinks/remarks", authMiddleware, async (req, res) => {
    try {
        // Extract the page, limit, and comments from the query parameters
        const { page = 1, limit = 10, comments = "" } = req.query;

        // Convert page and limit to integers
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // Calculate the number of documents to skip
        const skip = (pageNum - 1) * limitNum;

        // Build the filter query
        const filter = {
            userId: req.user.id,
        };
        if (comments) {
            filter.comments = { $regex: comments, $options: "i" }; // Case-insensitive search for comments
        }

        // Fetch the links with pagination
        const links = await Link.find(filter)
            .skip(skip)
            .limit(limitNum);

        // Transform the data to include only the required fields
        const transformedLinks = links.map((link) => {
            // Format the updatedAt field
            const formattedUpdatedAt = new Date(link.updatedAt).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });

            return {
                _id: link._id,
                updatedAt: formattedUpdatedAt,
                destinationUrl: link.destinationUrl,
                shortUrl: link.shortUrl,
                comments: link.comments,
                clickCount: link.clickCount,
                linkExpiration: link.linkExpiration,
                linkExpirationDate: link.expirationDate,
            };
        });

        // Get total count of filtered links
        const totalLinks = await Link.countDocuments(filter);
        const totalPages = Math.ceil(totalLinks / limitNum);

        // Send the response with the transformed links
        res.status(200).json({
            links: transformedLinks,
            totalLinks,
            totalPages,
            currentPage: pageNum,
            limit: limitNum,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});






router.get("/userlinks/:id", authMiddleware, async (req, res) => {
    try {
        const link = await Link.findById(req.params.id);

        if (!link || link.userId.toString() !== req.user.id) {
            return res.status(404).json({ error: "Link not found or you do not have permission to view it." });
        }

        res.status(200).json({ message: "Link retrieved successfully.", link });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});






router.get("/click/userclicks", authMiddleware, async (req, res) => {
    try {
        const links = await Link.find({ userId: req.user.id });
        let totalClicks = 0;

        for (const link of links) {
            totalClicks += link.clickCount;
        }

        res.status(200).json({ totalClicks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// GET: Retrieve overall total clicks for the current user (from both Link and Click collections)
router.get("/click/userclicksoverall", authMiddleware, async (req, res) => {
    try {
        // Get total clicks from Link schema (clickCount field)
        const links = await Link.find({ userId: req.user.id });
        let totalLinkClicks = 0;

        for (const link of links) {
            totalLinkClicks += link.clickCount;
        }

        // Get total clicks from Click schema (individual click records)
        const totalClickRecords = await Click.aggregate([
            { $match: { userId: req.user.id } },
            { $count: "totalClicks" },
        ]);

        // If the user has clicks recorded in the Click collection
        const totalClickClicks = totalClickRecords.length > 0 ? totalClickRecords[0].totalClicks : 0;

        // Combine total clicks from both sources
        const overallTotalClicks = totalLinkClicks + totalClickClicks;

        res.status(200).json({ overallTotalClicks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// GET: Retrieve click counts by date for the current user
router.get("/userclicks/devicewise", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id; // Get the logged-in user's ID

        // Aggregate clicks for the logged-in user and group by device type
        const clicks = await Click.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } }, // Match clicks for the logged-in user
            { $group: { _id: "$deviceType", totalClicks: { $sum: 1 } } },
        ]);

        res.status(200).json({ clicks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});



// GET: Retrieve click counts by device type for the current user
router.get("/userclicks/datewise", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Ensure the aggregation matches clicks only for the logged-in user
        const clicks = await Click.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } }, // Correct usage of ObjectId
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    dailyClicks: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } }, // Sort by date in ascending order
        ]);

        // Calculate cumulative clicks
        let cumulativeClicks = 0;
        const cumulativeClickData = clicks.map((click) => {
            cumulativeClicks += click.dailyClicks;
            return {
                date: click._id,
               // dailyClicks: click.dailyClicks,
                totalClicks: cumulativeClicks,
            };
        });

        // Calculate total link clicks across all links for the user
        const totalLinkClicks = await Click.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });

        res.status(200).json({ cumulativeClickData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});




router.get("/click/responcces", authMiddleware, async (req, res) => {
   try {
        const userId = req.user.id;

        // Pagination parameters from query
        const { page = 1, limit = 10 } = req.query; // Defaults: page 1, 10 items per page
        const skip = (page - 1) * limit;

        // Find click details for the user
        const clickDetails = await ClickDetails.find({ userId })
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Transform the data
        const transformedData = clickDetails.map((detail) => {
            
        
            // Extract device type from the deviceInfo field
            let deviceType = "Unknown";
            if (/Android/i.test(detail.deviceInfo)) {
                deviceType = "Android";
            } else if (/iPhone|iPad|iPod/i.test(detail.deviceInfo)) {
                deviceType = "iOS";
            } else if (/Windows/i.test(detail.deviceInfo)) {
                deviceType = "Windows";
            } else if (/Macintosh|Mac OS X/i.test(detail.deviceInfo)) {
                deviceType = "Mac";
            } else if (/Linux/i.test(detail.deviceInfo)) {
                deviceType = "Linux";
            }
        
            // Format the date
            const formattedDate = new Date(detail.date).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        
            return {
                Timestamp: formattedDate,
                "OriginalLink": detail.originalLink,
                "ShortLink": detail.shortLink,
                "IPAddress": detail.ipAddress,
                "UserDevice": `${deviceType}`,
            };
        });
        
       

        // Get total count for pagination metadata
        const total = await ClickDetails.countDocuments({ userId });

        // Send the response with pagination info
        res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            data: transformedData,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});





module.exports = router;
