const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const redis = require("redis");

// Redis client for session state management
const redisClient = redis.createClient();
const pubClient = redis.createClient(); // For pub/sub messaging
const subClient = redis.createClient();

// Enable Redis v4 promises support
redisClient.connect();
pubClient.connect();
subClient.connect();

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8200 });

// Store connection counts in the server memory (this is per server instance)
const connectionCounts = new Map(); // Track the number of connections per IP

// Define rate limiting parameters
const MAX_MESSAGES_PER_SECOND = 2;
const MAX_CONNECTIONS_PER_IP = 3;

// Store connection counts in the server memory
let connectedClients = 0; // Track the number of clients connected
let heartbeatInterval = 5000; // Default heartbeat interval (5 seconds)

const adjustHeartbeatInterval = () => {
  if (connectedClients <= 1) {
    heartbeatInterval = 5000; // Few clients, send heartbeat every 5 seconds
  } else if (connectedClients <= 2) {
    heartbeatInterval = 15000; // Moderate load, send heartbeat every 15 seconds
  } else {
    heartbeatInterval = 30000; // High load, send heartbeat every 30 seconds
  }
  console.log(
    `Adjusting heartbeat interval to ${
      heartbeatInterval / 1000
    } seconds for ${connectedClients} clients.`
  );
};

const sendHeartbeats = () => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
    }
  });
};

let heartbeatTimer = setInterval(sendHeartbeats, heartbeatInterval);

const priorityQueue = [];

// Function to enqueue messages based on priority
const enqueueMessage = (message, priority) => {
  priorityQueue.push({ message, priority });
  // Sort messages by priority (higher numbers first)
  priorityQueue.sort((a, b) => b.priority - a.priority);
};

const processMessages = () => {
  while (priorityQueue.length > 0) {
    const { message } = priorityQueue.shift(); // Take the highest priority message
    // Broadcast the message to all connected clients
    console.log("message::::::::::",message)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
};

// Subscribing to Redis pub/sub to receive messages from other WebSocket servers
// subClient.subscribe("broadcast", (message) => {
//     try {
//         // Parse the received message (as it's published as a JSON string)
//         const parsedMessage = JSON.parse(message);
  
//         // Enqueue the message based on its priority
//         enqueueMessage(parsedMessage.message, parsedMessage.priority || 1); // Default to low priority if not provided
  
//         // Process the queue to send messages in priority order
//         processMessages();
//       } catch (error) {
//         console.error("Error parsing message from Redis:", error);
//       }
// });

// Correctly handle incoming Pub/Sub messages
// subClient.on('message', (channel, message) => {
//     console.log("channel:::",channel)
//     if (channel === 'broadcast') {
//         // Broadcast message to all local clients
//         console.log("message",message)
//         wss.clients.forEach((client) => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(message);
//             }
//         });
//     }
// });
// subClient.on("message", (channel, message) => {
//   if (channel === "broadcast") {
//     // Handle the received message by adding it to the priority queue
//     try {
//       // Parse the received message (as it's published as a JSON string)
//       const parsedMessage = JSON.parse(message);

//       // Enqueue the message based on its priority
//       enqueueMessage(parsedMessage.message, parsedMessage.priority || 1); // Default to low priority if not provided

//       // Process the queue to send messages in priority order
//       processMessages();
//     } catch (error) {
//       console.error("Error parsing message from Redis:", error);
//     }
//   }
// });

wss.on("connection", async (ws, req) => {
  // Get client IP
  const clientIp = req.socket.remoteAddress;

  // Throttling: Limit the number of connections per IP
  const currentConnectionCount = connectionCounts.get(clientIp) || 0;
  if (currentConnectionCount >= MAX_CONNECTIONS_PER_IP) {
    console.log("Too many IP connections");
    ws.send("Exceeded the limit of users for WebSocket");
    ws.close();
    return;
  }
  connectionCounts.set(clientIp, currentConnectionCount + 1);

  connectedClients++;
  adjustHeartbeatInterval();

  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(sendHeartbeats, heartbeatInterval);

  // Assign a unique ID to each connected client and store session in Redis
  const clientId = uuidv4();

  // Check if session exists, if not, initialize session data in Redis
  const exists = await redisClient.hExists(
    `session:${clientId}`,
    "messageCount"
  );
  if (!exists) {
    await redisClient.hSet(`session:${clientId}`, "messageCount", 0);
    await redisClient.hSet(
      `session:${clientId}`,
      "lastMessageTimestamp",
      Date.now()
    );
  }

  console.log(`Client connected with ID: ${clientId}, IP: ${clientIp}`);
  ws.send(`Your ID is: ${clientId}`);

  // Handle incoming messages
  ws.on("message", async (message) => {
    // Fetch session data from Redis
    const sessionData = await redisClient.hGetAll(`session:${clientId}`);
    let messageCount = parseInt(sessionData.messageCount) || 0;
    let lastMessageTimestamp =
      parseInt(sessionData.lastMessageTimestamp) || Date.now();
    const currentTime = Date.now();

    // Rate Limiting: Check how many messages the client has sent in the last second
    if (currentTime - lastMessageTimestamp < 2000) {
      messageCount++;
    } else {
      messageCount = 1; // Reset counter every two seconds
      lastMessageTimestamp = currentTime;
    }

    if (messageCount > MAX_MESSAGES_PER_SECOND) {
      ws.send("Rate limit exceeded. Please slow down.");
      return; // Stop processing further if rate limit is exceeded
    }

    // Update the session data in Redis
    await redisClient.hSet(`session:${clientId}`, {
      messageCount: messageCount,
      lastMessageTimestamp: lastMessageTimestamp,
    });
    let priority = 1; // Default low priority
    const parsedMessage = JSON.parse(message);
    try {
      if (parsedMessage.type === "critical") {
        priority = 3; // High priority
      } else if (parsedMessage.type === "normal") {
        priority = 2; // Medium priority
      } else {
        priority = 1; // Low priority
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }

    // const clientMessage = `${clientId.substr(0, 5)} said: ${parsedMessage.content}`;

    const clientMessage = {
      type: parsedMessage.type,
      content: `${clientId.substr(0, 5)} said: ${parsedMessage.content}`,
      priority: priority,
    };

    // Publish message to Redis so other WebSocket instances receive it
    // pubClient.publish('broadcast', clientMessage);
    // pubClient.publish('broadcast', JSON.stringify({ message: clientMessage, priority }));
    pubClient.publish("broadcast", JSON.stringify(clientMessage));

    // Broadcast locally (for clients on this server)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(clientMessage));
      }
    });
  });

  // Handle client disconnects
  ws.on("close", async () => {
    connectionCounts.set(clientIp, connectionCounts.get(clientIp) - 1);

    connectedClients--;
    adjustHeartbeatInterval(); // Adjust heartbeat interval based on client load

    // Restart the heartbeat timer with the new interval
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeats, heartbeatInterval);

    // Remove session from Redis
    await redisClient.del(`session:${clientId}`);

    console.log(`Client with ID: ${clientId} disconnected`);
  });
});

console.log("WebSocket server is running on ws://localhost:8200");

// Close Redis connection on shutdown
process.on("SIGINT", () => {
  redisClient.quit();
  pubClient.quit();
  subClient.quit();
  clearInterval(heartbeatTimer);
  process.exit();
});
