// server.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const CONFIG = {
    INPUT_SEND_RATE_HZ: 12,
};

const wss = new WebSocket.Server({ port: 8080 });
const rooms = {};
const clients = {};

console.log('🏎️  F1 Multiplayer Server is running on ws://localhost:8080');

wss.on('connection', ws => {
    const clientId = uuidv4();
    clients[clientId] = { ws, roomId: null, lastState: null }; // ✅ ADD lastState
    ws.send(JSON.stringify({ type: 'welcome', clientId }));
    ws.on('message', message => handleMessage(clientId, message));
    ws.on('close', () => handleDisconnect(clientId));
});

function handleMessage(clientId, message) {
    try {
        const data = JSON.parse(message);
        console.log(`Received ${data.type} from ${clientId.substring(0, 8)}`); // ✅ DEBUG
        
        switch (data.type) {
            case 'createRoom': handleCreateRoom(clientId, data); break;
            case 'joinRoom': handleJoinRoom(clientId, data); break;
            case 'startGame': handleStartGame(clientId); break;
            case 'input':
                const player = clients[clientId];
                if (player?.roomId && rooms[player.roomId]?.players[clientId]) {
                    // ✅ FIX: Store the state properly
                    rooms[player.roomId].players[clientId].state = data.state;
                    // ✅ ALSO store in client for backup
                    clients[clientId].lastState = data.state;
                }
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

function handleCreateRoom(clientId, data) {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomId] = { id: roomId, hostId: clientId, track: data.track, gameStarted: false, players: {} };
    console.log(`Room ${roomId} created by ${clientId.substring(0, 8)}`);
    handleJoinRoom(clientId, { roomId, playerName: data.playerName });
}

function handleJoinRoom(clientId, data) {
    const { roomId, playerName } = data;
    const room = rooms[roomId];
    if (!room) { 
        clients[clientId]?.ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); 
        return; 
    }
    
    if (clients[clientId].roomId) { 
        handleDisconnect(clientId, true); 
    }

    clients[clientId].roomId = roomId;
    room.players[clientId] = { 
        id: clientId, 
        name: playerName, 
        state: { position: { x: 0, z: 0 }, rotationAngle: 0 } // ✅ INITIAL STATE
    };
    
    const playersList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
    const message = { 
        type: 'joined', 
        roomId, 
        players: playersList, 
        track: room.track, 
        hostId: room.hostId 
    };
    
    console.log(`Player ${playerName} (${clientId.substring(0, 8)}) joined room ${roomId}`);
    
    clients[clientId].ws.send(JSON.stringify(message));
    broadcastToRoom(roomId, { ...message, type: 'playerJoined' }, clientId);
}

function handleStartGame(clientId) {
    const room = rooms[clients[clientId]?.roomId];
    if (room && room.hostId === clientId && !room.gameStarted) {
        room.gameStarted = true;
        console.log(`Game started in room ${room.id}`);
        broadcastToRoom(room.id, { type: 'gameStarted' });
    }
}

function handleDisconnect(clientId, isRejoining = false) {
    const player = clients[clientId];
    if (!player) return;
    const roomId = player.roomId;
    const room = rooms[roomId];
    if (room) {
        delete room.players[clientId];
        const playersList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
        if (playersList.length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted (no players left)`);
        } else {
            if (room.hostId === clientId) { 
                room.hostId = playersList[0].id; 
                console.log(`New host for room ${roomId}: ${playersList[0].name}`);
            }
            broadcastToRoom(roomId, { type: 'playerLeft', players: playersList, hostId: room.hostId });
        }
    }
    delete clients[clientId];
    if (!isRejoining) console.log(`Client ${clientId.substring(0, 8)} disconnected.`);
}

function broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = rooms[roomId];
    if (!room) return;
    const messageString = JSON.stringify(message);
    let sentCount = 0;
    
    for (const clientId in room.players) {
        if (clientId !== excludeClientId) {
            const client = clients[clientId];
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(messageString);
                sentCount++;
            }
        }
    }
    console.log(`Broadcast ${message.type} to ${sentCount} players in room ${roomId}`);
}

// ✅ FIXED: Proper state collection and broadcasting
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameStarted) {
            const states = {};
            let hasValidStates = false;
            
            for (const clientId in room.players) {
                const player = room.players[clientId];
                // ✅ FIX: Use the state stored in the room player object
                if (player.state && player.state.position && player.state.rotationAngle !== undefined) {
                    states[clientId] = {
                        x: player.state.position.x,
                        z: player.state.position.z,
                        rotY: player.state.rotationAngle
                    };
                    hasValidStates = true;
                } else {
                    // ✅ FIX: Use backup state from client or default
                    const client = clients[clientId];
                    if (client && client.lastState) {
                        states[clientId] = {
                            x: client.lastState.position.x,
                            z: client.lastState.position.z,
                            rotY: client.lastState.rotationAngle
                        };
                        hasValidStates = true;
                    } else {
                        // Default state
                        states[clientId] = { x: 0, z: 0, rotY: 0 };
                    }
                }
            }
            
            if (hasValidStates) {
                console.log(`Room ${roomId} broadcasting states for players:`, Object.keys(states));
                broadcastToRoom(roomId, { type: 'serverTick', players: states });
            }
        }
    }
}, 1000 / CONFIG.INPUT_SEND_RATE_HZ);