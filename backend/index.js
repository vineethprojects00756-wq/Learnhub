const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const DBConnection = require('./config/connect')
const path = require("path");
const fs = require('fs')
const http = require("http");
const { initSocket } = require("./realtime/socket");
const { processScheduledPublishes } = require("./utils/publishScheduler");

const app = express()
const server = http.createServer(app);
dotenv.config()

//////connection of DB/////////
DBConnection()

const PORT = Number(process.env.PORT) || 5000;


//////middleware/////////
app.use(express.json())
app.use(cors())

const uploadsDir = path.join(__dirname, "uploads");

// Create uploads folder if it doesn’t exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


///ROUTES///
app.use('/api/admin', require('./routers/adminRoutes'))
app.use('/api/user', require('./routers/userRoutes'))



initSocket(server);
setInterval(() => {
  processScheduledPublishes().catch(() => {});
}, 60 * 1000);

server.listen(PORT, () => console.log(`running on ${PORT}`))
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Set a different PORT in backend/.env.`);
    return;
  }
  console.error("Server failed to start:", error.message);
});
