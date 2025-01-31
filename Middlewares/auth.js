const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User=require("../Schema/user.Schema");

dotenv.config();
const authMiddleware =async(req, res, next) => {
    const token = req.headers.authorization;  
    if (!token) {
        return res.status(401).json({ message: "This action is not allowed" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
       

           if (user.tokenIssuedAt && user.tokenIssuedAt > decoded.iat * 1000) {
            return res.status(401).json({ message: "Session expired, please log in again" });
        }
        
        req.user = decoded;
        
        next();
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Invalid token" });
    }
};
module.exports = authMiddleware;
