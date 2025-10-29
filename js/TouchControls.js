export class TouchControls {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('TouchControls container not found!');
            return;
        }

        this.joystick = this._createJoystick();
        this.buttons = {
            throttle: this._createButton('throttle-button', 'Throttle'),
            brake: this._createButton('brake-button', 'Brake')
        };

        this.container.style.display = this._isTouchDevice() ? 'block' : 'none';
    }

    _isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    _createJoystick() {
        // Use existing elements instead of creating new ones
        const joystickContainer = document.getElementById('joystick-container');
        const joystickHead = document.getElementById('joystick-head');

        if (!joystickContainer || !joystickHead) {
            console.error('Joystick elements not found in DOM');
            return { horizontal: 0, vertical: 0 };
        }

        let active = false;
        let initialX, initialY;
        let currentX, currentY;
        const state = { horizontal: 0, vertical: 0 };
        const maxRange = 50; // pixels

        const handleTouch = (e) => {
            const touch = e.touches[0];
            currentX = touch.clientX - initialX;
            currentY = touch.clientY - initialY;

            const distance = Math.sqrt(currentX * currentX + currentY * currentY);
            if (distance > maxRange) {
                currentX = (currentX / distance) * maxRange;
                currentY = (currentY / distance) * maxRange;
            }

            joystickHead.style.transform = `translate(${currentX}px, ${currentY}px)`;
            state.horizontal = currentX / maxRange;
            state.vertical = -currentY / maxRange; // Invert Y
        };

        joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            active = true;
            const touch = e.touches[0];
            initialX = touch.clientX;
            initialY = touch.clientY;
            joystickHead.style.transition = 'none';
        }, { passive: false });

        joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (active) {
                handleTouch(e);
            }
        }, { passive: false });

        joystickContainer.addEventListener('touchend', (e) => {
            e.preventDefault();
            active = false;
            joystickHead.style.transition = 'transform 0.2s ease-out';
            joystickHead.style.transform = 'translate(0, 0)';
            state.horizontal = 0;
            state.vertical = 0;
        }, { passive: false });

        return state;
    }

    _createButton(id, text) {
        // Use existing button instead of creating a new one
        const button = document.getElementById(id);
        if (!button) {
            console.error(`Button ${id} not found in DOM`);
            return { pressed: false };
        }

        // Set the text if provided (optional)
        if (text) {
            button.textContent = text;
        }

        const state = { pressed: false };

        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            state.pressed = true;
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        }, { passive: false });

        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            state.pressed = false;
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        }, { passive: false });

        return state;
    }
    // Add to the TouchControls class
    hideJoystick() {
        const joystickContainer = document.getElementById('joystick-container');
        const joystickHead = document.getElementById('joystick-head');

        // Use visibility instead of display to preserve layout
        if (joystickContainer) {
            joystickContainer.style.visibility = 'hidden';
            joystickContainer.style.pointerEvents = 'none';
        }
        if (joystickHead) {
            joystickHead.style.visibility = 'hidden';
        }
        console.log('🎮 Joystick hidden');
    }

    showJoystick() {
        const joystickContainer = document.getElementById('joystick-container');
        const joystickHead = document.getElementById('joystick-head');

        if (joystickContainer) {
            joystickContainer.style.visibility = 'visible';
            joystickContainer.style.pointerEvents = 'auto';
        }
        if (joystickHead) {
            joystickHead.style.visibility = 'visible';
        }
        console.log('🎮 Joystick shown');
    }
}