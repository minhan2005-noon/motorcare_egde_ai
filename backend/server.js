const express = require("express")
const app = express()
const xac_thuc = require("./phan_1/xac_thuc.js")
app.use(express.json())
app.use("/api/xac_minh", xac_thuc)
const port = 9000
app.get("/", async(req, res)=>{
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve()
        },10000)
    })
    res.json({
        message: "server dang chay"
    }) 
})
app.listen(port, ()=>{
console.log(`http://localhost:${port}`)
})