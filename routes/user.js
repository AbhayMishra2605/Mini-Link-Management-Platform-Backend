const express = require("express");
const router = express.Router();
const User = require("../Schema/user.Schema");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
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
        id: user._id,
    };
      
    const token = jwt.sign(payload, process.env.JWT_SECRET);
   
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
        id: user._id,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET);
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

      
      if (!name && !email && !mobile ) {
          return res.status(400).json({
              message: "No data provided to update. Please provide at least one field to update."
          });
      }

      const updatedFields = {};
      if (name) updatedFields.name = name;
      if (email) updatedFields.email = email;
      if (mobile) updatedFields.mobile = mobile;
      
     

      
      const updatedUser = await User.findByIdAndUpdate(req.user.id, updatedFields, { new: true });

      if (updatedUser) {
          
        const payload = {
          id: user._id,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET);
      return res.status(200).json({ token });
      } else {
          return res.status(500).json({ message: "Failed to update user" });
      }
  } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Internal Server Error" });
  }
});

  

router.get('/data',(req,res)=>{
   
    User.find().then((data)=>{
        return res.json(data);
        }).catch((err)=>{
            res.status(400).json({message:"Error has come"});
            })
})
module.exports = router;