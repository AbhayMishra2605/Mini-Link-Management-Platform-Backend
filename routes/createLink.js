const express = require("express");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const Link = require("../Schema/createLink.schema");
const authMiddleware = require('../Middlewares/auth');
const Click = require("../Schema/click.schema");

const router = express.Router();

// POST: Create a new shortened link
// POST: Create a new shortened link
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

        const shortUrlCode = shortid.generate();
        const shortUrl = `${req.protocol}://${req.get("host")}/${shortUrlCode}`;

        const newLink = new Link({
            userId: req.user.id,
            destinationUrl,
            shortUrl,
            comments,
            linkExpiration,
            expirationDate: linkExpiration ? expirationDate : null,
        });

        await newLink.save();
        res.status(201).json({ message: "Link created successfully", link: newLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});


// GET: Redirect to the actual destination URL
// GET: Redirect to the actual destination URL and track click
// GET: Redirect to the actual destination URL and track click
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

        // Increment click count for the link
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

        // Count total number of links to calculate total pages
        const totalLinks = await Link.countDocuments({ userId: req.user.id });

        // Calculate total pages
        const totalPages = Math.ceil(totalLinks / limitNum);

        res.status(200).json({
            message: "Links retrieved successfully.",
            links,
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
router.get("/userclicks/datewise", authMiddleware, async (req, res) => {
    try {
        const clicks = await Click.aggregate([
            { $group: { _id: "$deviceType", totalClicks: { $sum: 1 } } },
        ]);

        res.status(200).json({ clicks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});


// GET: Retrieve click counts by device type for the current user
router.get("/userclicks/devicewise", authMiddleware, async (req, res) => {
    try {
        const clicks = await Click.aggregate([
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, totalClicks: { $sum: 1 } } },
            { $sort: { _id: 1 } }, // Sort by date in ascending order
        ]);

        res.status(200).json({ clicks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});


module.exports = router;
