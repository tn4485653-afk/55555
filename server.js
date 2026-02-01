const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const ADMIN_PASS = process.env.ADMIN_PASS || "123456";
const MONGO_URI = process.env.MONGO_URI || "";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ===== MongoDB ===== */
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"));
}

const Message = mongoose.models.Message || mongoose.model("Message", {
  from: String,
  to: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});

/* ===== State ===== */
let adminSocket = null;
let lastMsgTime = {}; // anti spam

io.on("connection", socket => {

  /* ===== ADMIN LOGIN ===== */
  socket.on("admin_login", pass => {
    if (pass !== ADMIN_PASS) {
      socket.emit("admin_fail");
      return socket.disconnect();
    }
    adminSocket = socket;
    io.emit("admin_status", true);
  });

  /* ===== GUEST JOIN ===== */
  socket.on("guest_join", async userId => {
    if (!MONGO_URI) return;
    const history = await Message.find({
      $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: 1 });
    socket.emit("history", history);
  });

  /* ===== GUEST MESSAGE ===== */
  socket.on("guest_message", async data => {
    const now = Date.now();
    if (now - (lastMsgTime[socket.id] || 0) < 800) return;
    lastMsgTime[socket.id] = now;

    if (MONGO_URI) await Message.create(data);
    if (adminSocket) adminSocket.emit("admin_receive", data);
  });

  /* ===== ADMIN REPLY ===== */
  socket.on("admin_reply", async data => {
    if (MONGO_URI) await Message.create(data);
    io.emit("guest_receive", data);
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    if (socket === adminSocket) {
      adminSocket = null;
      io.emit("admin_status", false);
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("🚀 Server running on port " + PORT)
);