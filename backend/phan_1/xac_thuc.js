const express = require("express")
const router = express.Router()
router.post("/dang_nhap", async(req, res)=>{
    const {email, password} = req.body
    if(!email || !password){
        return res.status(404).json({
            success: false,
            message: "vui long nhap email va mat khau"
        })
    }
    res.json({
        success: true,
        message: "nhap thanh cong",
        user: {
            email,
        },
    })
})
router.post("/dang_ky",async(req, res)=>{
    const {ten, email, password} = req.body
    if(!ten || !email || !password){
        res.status(404).json({
            success: false,
            message: "nhap day du"
        })
    }
    res.json({
        success: true,
        user: {
            name: ten,
            email: email,
            pass: password
        }
    })
})
module.exports = router