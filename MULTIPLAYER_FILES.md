# Multiplayer Functionality Files

This document outlines the files involved in the multiplayer functionality of the F1 Sim application, to aid in troubleshooting and understanding the codebase.

## 1. `js/NetworkManager.js`
- **Role**: Manages the WebSocket connection, sends and receives messages from the server, handles room creation and joining, and synchronizes remote player states. It dispatches custom events for UI updates related to network activity.
- **Key Responsibilities**:
    - Establishing and maintaining WebSocket connection.
    - Sending player input and game state to the server.
    - Receiving server updates (e.g., `welcome`, `roomCreated`, `joined`, `playerJoined`, `playerLeft`, `serverTick`, `gameStarted`, `error`).
    - Managing remote player meshes in the Three.js scene.

## 2. `js/main.js`
- **Role**: The main entry point of the application. It initializes the `NetworkManager`, sets up event listeners for multiplayer UI elements (like "Create New Room" and "Join Existing Room" buttons), and integrates network events with the game's UI and state.
- **Key Responsibilities**:
    - Instantiating `NetworkManager`.
    - Handling UI interactions for multiplayer (e.g., `createRoomButton`, `joinRoomButton`).
    - Listening for `roomJoined` and other custom events dispatched by `NetworkManager` to update the UI.
    - Setting `gameState.isMultiplayer`.

## 3. `js/UIManager.js`
- **Role**: Manages all user interface elements, including the network lobby and the waiting screen. It provides methods to show/hide these menus and update their content based on game and network state.
- **Key Responsibilities**:
    - Displaying and hiding the network menu (`showNetworkMenu`, `hideNetworkMenu`).
    - Displaying the "Waiting for players..." screen with the room ID (`showWaitingForPlayersScreen`).
    - Populating track selection dropdowns.

## 4. `js/State.js`
- **Role**: Defines the global `gameState` object, which holds the current state of the game, including multiplayer-specific flags and data.
- **Key Responsibilities**:
    - Storing `isMultiplayer` flag.
    - Holding the `networkManager` instance.
    - Managing `remotePlayers` (a Map of remote player IDs to their game objects).

## 5. `js/Config.js`
- **Role**: Stores global configuration settings for the application, including network-related parameters.
- **Key Responsibilities**:
    - Defining `SERVER_URL` for the WebSocket connection.
    - Setting `INPUT_SEND_RATE_HZ` for how frequently player input is sent to the server.

## 6. `js/CarModel.js`
- **Role**: Provides the function to create the 3D car model. This is relevant because `NetworkManager` uses it to create visual representations of remote players.
- **Key Responsibilities**:
    - `createF1Car` function, used for both local and remote player meshes.