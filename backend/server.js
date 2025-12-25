import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid"; // Recommended: npm install uuid

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for your devtunnels URLs
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// The queue of users looking for a match
let waitingQueue = [];

io.on("connection", (socket) => {
  console.log("User connected: ", socket.id);

  socket.on("join-queue", () => {
    console.log(`${socket.id} joined the queue`);

    // 1. Check if there is someone already waiting
    if (waitingQueue.length > 0) {
      // 2. Match with a random person from the queue
      const randomIndex = Math.floor(Math.random() * waitingQueue.length);
      const peerSocketId = waitingQueue.splice(randomIndex, 1)[0];
      const peerSocket = io.sockets.sockets.get(peerSocketId);

      if (peerSocket) {
        // 3. Create a unique Room ID for this pair
        const roomId = uuidv4();

        // 4. Join both users to the new room
        socket.join(roomId);
        peerSocket.join(roomId);

        // 5. Assign roles
        // We tell the person who was waiting to be the CALLER
        peerSocket.emit("role", "caller");
        peerSocket.emit("matched", { roomId, peerId: socket.id });

        // We tell the person who just joined to be the CALLEE
        socket.emit("role", "callee");
        socket.emit("matched", { roomId, peerId: peerSocketId });

        // 6. Signal the caller to start the offer process
        setTimeout(() => {
          io.to(roomId).emit("ready");
        }, 1000);

        console.log(
          `Matched ${socket.id} and ${peerSocketId} in room ${roomId}`
        );
      } else {
        // If the peer disconnected while in queue, try again or add current user to queue
        waitingQueue.push(socket.id);
      }
    } else {
      // 7. No one is waiting, add this user to the queue
      if (!waitingQueue.includes(socket.id)) {
        waitingQueue.push(socket.id);
      }
      socket.emit("waiting", "Looking for a partner...");
    }
  });

  /* --- WebRTC Signaling (Unchanged but using roomId from client) --- */

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    // 8. Remove from queue if they were still waiting
    waitingQueue = waitingQueue.filter((id) => id !== socket.id);
    console.log("User disconnected and removed from queue:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Signaling server running on http://localhost:5000");
});
