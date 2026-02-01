const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const ADMIN_PASS = process.env.ADMIN_PASS || "123456";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let adminSocket = null;

io.on("connection", socket => {

  socket.on("admin_login", pass => {
    if (pass !== ADMIN_PASS) {
      socket.emit("admin_fail");
      return;
    }
    adminSocket = socket;
    io.emit("admin_status", true);
  });

  socket.on("guest_message", data => {
    if (adminSocket)
      adminSocket.emit("admin_receive", data);
  });

  socket.on("admin_reply", data => {
    io.emit("guest_receive", data);
  });

  socket.on("disconnect", () => {
    if (socket === adminSocket) {
      adminSocket = null;
      io.emit("admin_status", false);
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("🚀 Test server running on " + PORT)
);