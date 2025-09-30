const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });

const rooms = {};
const clients = {};

console.log('🏎️  F1 Multiplayer Server is running on ws://localhost:8080');

wss.on('connection', ws => {
    const clientId = uuidv4();
    clients[clientId] = { ws, roomId: null };
    console.log(`Client ${clientId.substring(0, 8)} connected.`);

    ws.send(JSON.stringify({ type: 'welcome', clientId }));

    ws.on('message', message => {
        const data = JSON.parse(message);
        const player = clients[clientId];

        switch (data.type) {
            case 'createRoom':
                handleCreateRoom(clientId, data);
                break;
            case 'joinRoom':
                handleJoinRoom(clientId, data);
                break;
            case 'startGame':
                handleStartGame(clientId);
                break;
            case 'input':
                if (player.roomId && rooms[player.roomId]?.players[clientId]) {
                    rooms[player.roomId].players[clientId].state = data.state;
                }
                break;
        }
    });

    ws.on('close', () => {
        handleDisconnect(clientId);
    });
});

function handleCreateRoom(clientId, data) {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const room = {
        id: roomId,
        hostId: clientId, // The creator is the host
        track: data.track,
        gameStarted: false,
        players: {},
    };
    rooms[roomId] = room;

    console.log(`Room ${roomId} created by ${clientId.substring(0, 8)} on track ${data.track}.`);
    handleJoinRoom(clientId, { roomId, playerName: data.playerName });
}

function handleJoinRoom(clientId, data) {
    const { roomId, playerName } = data;
    const room = rooms[roomId];
    const player = clients[clientId];

    if (!room) {
        player.ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    if (player.roomId) {
       handleDisconnect(clientId, true);
    }

    player.roomId = roomId;
    room.players[clientId] = {
        id: clientId,
        name: playerName,
        state: {}
    };

    console.log(`Client ${clientId.substring(0, 8)} (${playerName}) joined room ${roomId}.`);

    const playersList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
    
    // ✅ FIX: Send the hostId to the player who just joined
    player.ws.send(JSON.stringify({ type: 'joined', roomId, players: playersList, track: room.track, hostId: room.hostId }));
    
    // ✅ FIX: Send the hostId to everyone else in the room
    broadcastToRoom(roomId, { type: 'playerJoined', players: playersList, hostId: room.hostId }, clientId);
}

function handleStartGame(clientId) {
    const player = clients[clientId];
    const room = rooms[player.roomId];

    // This check now works because the client knows who the host is and will only send this message if it's the host.
    if (room && room.hostId === clientId && !room.gameStarted) {
        room.gameStarted = true;
        console.log(`Game starting in room ${room.id}.`);
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
            console.log(`Room ${roomId} is empty and has been closed.`);
        } else {
            // If the host left, assign a new host
            if (room.hostId === clientId) {
                room.hostId = playersList[0].id;
            }
            // ✅ FIX: Send the new hostId to the remaining players
            broadcastToRoom(roomId, { type: 'playerLeft', players: playersList, hostId: room.hostId });
        }
    }

    delete clients[clientId];
    if (!isRejoining) {
        console.log(`Client ${clientId.substring(0, 8)} disconnected.`);
    }
}

function broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = rooms[roomId];
    if (!room) return;

    const messageString = JSON.stringify(message);

    for (const clientId in room.players) {
        if (clientId !== excludeClientId) {
            clients[clientId]?.ws.send(messageString);
        }
    }
}

// Server-side game loop (no changes needed here)
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameStarted) {
            const states = {};
            for(const clientId in room.players) {
                const player = room.players[clientId];
                if (player.state && player.state.position) {
                    states[clientId] = {
                        x: player.state.position.x,
                        z: player.state.position.z,
                    };
                }
            }
            broadcastToRoom(roomId, { type: 'serverTick', players: states });
        }
    }
}, 1000 / 12);