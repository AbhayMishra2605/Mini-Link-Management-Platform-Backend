const express = require("express");
const router = express.Router();
const User = require("../Schema/user.Schema");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const ClickDetails =require("../Schema/responne.schema")
const Click = require("../Schema/click.schema");
const Link = require("../Schema/createLink.schema");
const authMiddleware = require('../Middlewares/auth')




router.post("/register", async (req, res) => {
  const { name, email,mobile, password } = req.body;

  
  const isUserExist = await User.findOne({ email });
  if (isUserExist) {
      return res.status(400).json({ message: "User already exists" });
  }

  try {
    
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

     
      const user = await User.create({
          name,
          email,
          mobile,
          password: hashedPassword,
             });

      const payload = {
        id: user._id, tokenIssuedAt: user.tokenIssuedAt
    };
      console.log(user.tokenIssuedAt);
    const token = jwt.sign(payload, process.env.JWT_SECRET,{expiresIn:"7d"});
   
   return res.status(200).json({ 
    message: "User and dashboard created successfully", 
    token:token,
    name:user.name,
    
});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error in creating user or dashboard" });
  }
});




router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "Wrong username or password" });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        return res.status(400).json({ message: "Wrong username or password" });
    }
    const payload = {
        id: user._id,tokenIssuedAt: user.tokenIssuedAt
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET,{expiresIn:"7d"});
    return res.status(200).json({ token:token,
    name:user.name });
})


router.put('/edituser', authMiddleware, async (req, res) => {
    const { name, email, mobile } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let emailUpdated = false; // Track if email is updated

        if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== req.user.id) {
                return res.status(400).json({ message: "Email already exists" });
            }

            // Update email & token timestamp to log out all devices
            user.email = email;
            user.tokenIssuedAt = Date.now();
            emailUpdated = true;
        }

        if (name) user.name = name;
        if (mobile) user.mobile = mobile;

        await user.save();

        if (emailUpdated) {
            return res.status(200).json({ message: "Email updated. Please log in again." });
        } else {
            return res.status(200).json({ message: "User updated successfully." });
        }

    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

  

//write a rought to get the user name
router.get('/getusername', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
            }
            return res.status(200).json({ name: user.name });
            } catch (err) {
            console.error("Error getting user:", err);
            res.status(500).json({ message: "Internal Server Error" });
            }
            });




//write a rought to delete the user
router.delete('/deleteuser', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
            }
        const userId = req.user.id;
        const deleteClickDetails = await ClickDetails.find({ userId })
        if (deleteClickDetails.length > 0) {
            await ClickDetails.deleteMany({ userId });
            }
        const deleteLink =await Link.find({ userId });
        if (deleteLink.length > 0) {
            await Link.deleteMany({ userId });
            }
        const deleteClick = await Click.find({ userId });
        if (deleteClick.length > 0) {
            await Click.deleteMany({ userId });
            }
            await User.findByIdAndDelete(req.user.id);
            
            return res.status(200).json({ message: "User deleted successfully" });
            } catch (err) {
                console.error("Error deleting user:", err);
                res.status(500).json({ message: "Internal Server Error" });
                }
                }
                );

            
module.exports = router;
