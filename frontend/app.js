const ws = new WebSocket('ws://localhost:8200');

ws.onmessage = (event) => {
    const el = document.createElement('li');
    try{
        const message = JSON.parse(event.data);
            if (message.type === 'heartbeat') {
                el.innerHTML = `Heartbeat received at ${new Date(message.timestamp).toLocaleTimeString()}`;
            } else {
                el.innerHTML = `Priority: ${message.type} | Message: ${message.content}`;
                // el.innerHTML = message;
            }
    } catch(e){

        el.innerHTML = event.data;
    }
    document.querySelector('ul').appendChild(el);
};

document.querySelector('button').onclick = () => {
    const text = document.querySelector('input').value;
    const priority = document.querySelector('select').value;

                    // Send message as JSON with the selected priority
                    const messageData = {
                        type: priority,
                        content: text
                    };
    ws.send(JSON.stringify(messageData));
    // ws.send(text);  // Send the message to the WebSocket server
};
