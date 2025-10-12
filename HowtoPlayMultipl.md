# How to Play F1 Sim Multiplayer

To play the F1 Sim in multiplayer mode, you need to run two separate servers: one for the WebSocket communication and another for serving the static web files (HTML, CSS, JavaScript).

## Steps:

1.  **Start the WebSocket Server:**
    Open your terminal, navigate to the project directory (`/Users/nacho/Documents/f1max/`), and run the Node.js server:
    ```bash
    node server.js
    ```
    You should see a message indicating the server is running, typically on `ws://localhost:8080`.

2.  **Start the HTTP Server:**
    Open a *separate* terminal tab or window, navigate to the same project directory (`/Users/nacho/Documents/f1max/`), and start the `http-server`:
    ```bash
    http-server .
    ```
    The `http-server` will provide you with a local URL (e.g., `http://192.168.100.58:8081`) where you can access the game in your web browser. Note that the port might be different from `8080` if the WebSocket server is already using it.

3.  **Access the Game:**
    Open your web browser and navigate to the `http://` address provided by the `http-server` (e.g., `http://192.168.100.58:8081`).

    Your game will load, and the client-side code will automatically attempt to connect to the WebSocket server for multiplayer functionality.

## Important Notes:

*   **Firewall:** Ensure your firewall is configured to allow incoming connections on port `8080` (for the WebSocket server) and the port used by `http-server` (e.g., `8081`) if you want other devices on your local network to connect.
*   **IP Address:** For other devices on your local Wi-Fi network to connect, they will need to use your machine's local IP address (e.g., `192.168.100.58`) in the browser URL, not `localhost`. The `SERVER_URL` in `js/Config.js` should also be set to this local IP for clients to connect correctly.