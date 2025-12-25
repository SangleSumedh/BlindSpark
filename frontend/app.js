const socket = io("https://vx3vbn0n-5000.inc1.devtunnels.ms", {
  transports: ["websocket"],
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const roomId = "test-room";

let localStream;
let peerConnection;
let role;

remoteVideo.muted = true;
remoteVideo.autoplay = true;
remoteVideo.playsInline = true;

const iceServers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

async function init() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = localStream;

  socket.emit("join-room", roomId);
}

function createPeerConnection() {
  if (peerConnection) return peerConnection;

  peerConnection = new RTCPeerConnection(iceServers);

  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      "ICE:",
      peerConnection.iceConnectionState,
      "CONN:",
      peerConnection.connectionState
    );
  };

  peerConnection.ontrack = (event) => {
    console.log("🔥 ONTRACK");
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        candidate: event.candidate,
      });
    }
  };

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  return peerConnection;
}

// socket.on("user-joined", async () => {
//   createPeerConnection();

//   const offer = await peerConnection.createOffer();
//   await peerConnection.setLocalDescription(offer);

//   socket.emit("offer", { roomId, offer });
// });

socket.on("role", (assignedRole) => {
  role = assignedRole;
});

socket.on("ready", async () => {
  if (role !== "caller") return;

  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { roomId, offer });
});

socket.on("offer", async (offer) => {
  createPeerConnection();

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async (candidate) => {
  if (peerConnection && candidate) {
    await peerConnection.addIceCandidate(candidate);
  }
});

init();

socket.on("role", (assignedRole) => {
  role = assignedRole;
  console.log("ROLE ASSIGNED:", role);
});
