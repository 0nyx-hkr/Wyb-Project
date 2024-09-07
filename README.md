# **WebSocket Messaging App**

This project demonstrates a simple WebSocket-based messaging system with message prioritization and broadcasting using Redis. The project consists of a **frontend** for users to join a WebSocket connection and send messages, and a **backend WebSocket server** that handles the connections, processes the messages, and broadcasts them using Redis.

## **Project Structure**

* **frontend/**  
  * `index.html`: The HTML page where users can join the WebSocket and send messages.  
  * `app.js`: The JavaScript file that connects to the WebSocket server and handles message sending and receiving.  
* **websocket/**  
  * `server.js`: The WebSocket server code that handles message broadcasting and prioritization using Redis.

## **Prerequisites**

1. **Node.js**: Make sure you have Node.js installed. You can download it from [here](https://nodejs.org/).  
2. **Redis**: Redis is required for broadcasting messages between WebSocket server instances. You can install Redis locally by following these steps:

### **Install Redis**

#### **On macOS (using Homebrew):**

bash  
`brew install redis`  
`brew services start redis`

#### **On Ubuntu/Debian:**

bash  
Copy code  
`sudo apt update`  
`sudo apt install redis-server`  
`sudo systemctl start redis`

#### **On Windows:**

Follow this guide to install Redis on Windows.

3. **Redis CLI**: Make sure you have Redis CLI installed to monitor broadcast messages. You can use the Redis CLI to subscribe to the `broadcast` channel.

## **Getting Started**

### **Step 1: Clone the repository**

bash  
`git clone <repository-url>`  
`cd <repository-directory>`

### **Step 2: Install Dependencies**

1. Navigate to the **websocket** directory and install the necessary Node.js dependencies.

bash  
Copy code  
`cd websocket`  
`npm install`

### **Step 3: Start Redis Server Locally**

Ensure Redis is running by executing the following command:

bash  
Copy code  
`redis-server`

You can also check the status of Redis:

bash  
Copy code  
`redis-cli ping`

You should see `PONG` if Redis is running successfully.

### **Step 4: Run WebSocket Server**

Once Redis is running, start the WebSocket server:

bash  
Copy code  
`cd websocket`  
`node server.js`

This will start the WebSocket server on `ws://localhost:8000`.

### **Step 5: Open the Frontend**

1. Navigate to the **frontend** folder.  
2. Open `index.html` in your browser. You can simply double-click the file or serve it with a local web server (e.g., [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for Visual Studio Code).

### **Step 6: Test WebSocket Messaging**

* Open multiple tabs with `index.html` loaded.  
* Send messages from one tab, and observe them being broadcasted to all connected clients.  
* Messages should appear with their corresponding priority level.

### **Step 7: Monitor Redis Broadcast Messages (Optional)**

To monitor the messages being broadcast via Redis, use the Redis CLI and subscribe to the `broadcast` channel:

bash  
Copy code  
`redis-cli`  
`SUBSCRIBE broadcast`

You will see the JSON-formatted messages broadcasted by the WebSocket server.

## **Features**

* **WebSocket Connection**: Users can connect to a WebSocket server and send messages.  
* **Message Prioritization**: Messages are prioritized based on their type (e.g., high, medium, low).

