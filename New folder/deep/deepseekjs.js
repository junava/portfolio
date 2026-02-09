// tetris-complete.js
class Tetris {
    constructor() {
        // Game settings
        this.COLS = 10;
        this.ROWS = 20;
        this.SIZE = 30;
        
        // Colors
        this.COLORS = [
            '#00FFFF', '#0000FF', '#FF8000', '#FFFF00',
            '#00FF00', '#800080', '#FF0000'
        ];
        
        // Pieces
        this.PIECES = [
            [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
            [[2,0,0],[2,2,2],[0,0,0]],
            [[0,0,3],[3,3,3],[0,0,0]],
            [[4,4],[4,4]],
            [[0,5,5],[5,5,0],[0,0,0]],
            [[0,6,0],[6,6,6],[0,0,0]],
            [[7,7,0],[0,7,7],[0,0,0]]
        ];
        
        // Game state
        this.reset();
        
        // DAS/ARR
        this.DAS = 133;
        this.ARR = 33;
        this.keys = {};
        this.dasTimers = {};
        this.arrTimers = {};
        
        // Controls
        this.controls = {
            left: 37, right: 39, rotate: 38, ccw: 90, rot180: 65,
            down: 40, hard: 32, hold: 67, pause: 80
        };
        
        // Load saved controls
        const saved = localStorage.getItem('tetris-controls');
        if (saved) this.controls = JSON.parse(saved);
        
        // Initialize
        this.createUI();
        this.setupEvents();
        this.draw();
    }
    
    reset() {
        this.board = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.time = 0;
        this.piecesPlaced = 0;
        this.active = false;
        this.paused = false;
        this.over = false;
        this.ghost = true;
        this.mode = 'endless';
        
        // Soft drop speed 
        this.softDropSpeed = 10;  // Default 10x faster than normal gravity

        // Lock delay system
        this.lockDelay = 500;
        this.lockTimer = 0;
        
        // 7-bag
        this.bag = [];
        this.current = null;
        this.next = null;
        this.hold = null;
        this.canHold = true;
        
        // Timing
        this.speed = 1000;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.lastSecond = 0;
        this.animationFrameId = null;
    }
    
    // ==================== DAS/ARR ====================
    updateDAS(time) {
        const now = time;
        
        // Left movement
        if (this.keys[this.controls.left]) {
            if (!this.dasTimers.left) {
                this.dasTimers.left = now;
                this.move(-1);
            }
            
            const held = now - this.dasTimers.left;
            if (held >= this.DAS) {
                if (!this.arrTimers.left) {
                    this.arrTimers.left = now;
                }
                
                const arrHeld = now - this.arrTimers.left;
                if (arrHeld >= this.ARR) {
                    this.move(-1);
                    this.arrTimers.left = now;
                }
            }
        } else {
            delete this.dasTimers.left;
            delete this.arrTimers.left;
        }
        
        // Right movement
        if (this.keys[this.controls.right]) {
            if (!this.dasTimers.right) {
                this.dasTimers.right = now;
                this.move(1);
            }
            
            const held = now - this.dasTimers.right;
            if (held >= this.DAS) {
                if (!this.arrTimers.right) {
                    this.arrTimers.right = now;
                }
                
                const arrHeld = now - this.arrTimers.right;
                if (arrHeld >= this.ARR) {
                    this.move(1);
                    this.arrTimers.right = now;
                }
            }
        } else {
            delete this.dasTimers.right;
            delete this.arrTimers.right;
        }
    }
    
    // ==================== GAME LOGIC ====================
    newPiece() {
        if (this.bag.length === 0) {
            this.bag = [0,1,2,3,4,5,6];
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        
        const type = this.bag.shift();
        return {
            type: type,
            x: Math.floor(this.COLS / 2) - Math.floor(this.PIECES[type][0].length / 2),
            y: 0,
            matrix: this.PIECES[type].map(row => [...row])
        };
    }
    
    collision(piece = this.current) {
        if (!piece) return true;
        
        for (let y = 0; y < piece.matrix.length; y++) {
            for (let x = 0; x < piece.matrix[y].length; x++) {
                if (piece.matrix[y][x]) {
                    const boardY = y + piece.y;
                    const boardX = x + piece.x;
                    
                    if (boardY < 0) continue;
                    if (boardY >= this.ROWS || boardX < 0 || boardX >= this.COLS || this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    move(dir) {
        if (!this.active || this.paused || this.over || !this.current) return;
        
        this.current.x += dir;
        if (this.collision()) {
            this.current.x -= dir;
        } else {
            this.lockTimer = 0; // Reset lock timer on successful movement
        }
    }
    
    rotate(dir = 1) {
        if (!this.active || this.paused || this.over || !this.current) return;
        
        const oldMatrix = this.current.matrix.map(row => [...row]);
        const oldX = this.current.x;
        const oldY = this.current.y;
        
        // Rotate matrix
        const size = this.current.matrix.length;
        const rotated = Array(size).fill().map(() => Array(size).fill(0));
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (dir === 1) {
                    rotated[x][size - 1 - y] = this.current.matrix[y][x];
                } else if (dir === -1) {
                    rotated[size - 1 - x][y] = this.current.matrix[y][x];
                } else if (dir === 2) {
                    rotated[size - 1 - y][size - 1 - x] = this.current.matrix[y][x];
                }
            }
        }
        
        this.current.matrix = rotated;
        
        // Wall kicks
        const kicks = [[0,0], [0,-1], [1,0], [-1,0], [0,1], [1,1], [-1,1]];
        for (const [dx, dy] of kicks) {
            this.current.x = oldX + dx;
            this.current.y = oldY + dy;
            if (!this.collision()) {
                this.lockTimer = 0; // Reset lock timer on successful rotation
                return;
            }
        }
        
        this.current.matrix = oldMatrix;
        this.current.x = oldX;
        this.current.y = oldY;
    }
    
    drop() {
        if (!this.active || this.paused || this.over || !this.current) return;
        
        this.current.y++;
        if (this.collision()) {
            this.current.y--;
            this.lockTimer += 33; // Add some lock time for manual drops
        } else {
            this.lockTimer = 0; // Reset on successful movement
        }
    }
    
    hardDrop() {
        if (!this.active || this.paused || this.over || !this.current) return;
        
        while (!this.collision()) {
            this.current.y++;
        }
        this.current.y--;
        this.placePiece();
    }
    
    placePiece() {
        // Merge current piece to board
        for (let y = 0; y < this.current.matrix.length; y++) {
            for (let x = 0; x < this.current.matrix[y].length; x++) {
                if (this.current.matrix[y][x]) {
                    const boardY = this.current.y + y;
                    if (boardY >= 0) {
                        this.board[boardY][this.current.x + x] = this.current.type + 1;
                    }
                }
            }
        }
        
        this.piecesPlaced++;
        this.clearLines();
        this.resetPiece();
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let y = this.ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.COLS).fill(0));
                y++;
                linesCleared++;
                this.lines++;
            }
        }
        
        if (linesCleared > 0) {
            const points = [0, 100, 300, 500, 800];
            this.score += points[linesCleared] * this.level;
            
            this.level = Math.floor(this.lines / 10) + 1;
            this.speed = Math.max(100, 1000 - (this.level - 1) * 50);
            
            if (this.mode === '40lines' && this.lines >= 40) {
                this.endGame(true);
            }
        }
    }
    
    resetPiece() {
        this.current = this.next;
        this.next = this.newPiece();
        this.canHold = true;
        this.lockTimer = 0;
        
        if (this.collision()) {
            this.endGame();
        }
    }
    
    holdPiece() {
        if (!this.active || this.paused || this.over || !this.canHold || !this.current) return;
        
        if (!this.hold) {
            this.hold = this.current.type;
            this.resetPiece();
        } else {
            const temp = this.current.type;
            this.current.type = this.hold;
            this.current.matrix = this.PIECES[this.hold].map(row => [...row]);
            this.current.x = Math.floor(this.COLS / 2) - Math.floor(this.PIECES[this.hold][0].length / 2);
            this.current.y = 0;
            this.hold = temp;
            
            if (this.collision()) {
                this.endGame();
                return;
            }
        }
        
        this.canHold = false;
        this.lockTimer = 0;
    }
    
    // ==================== GAME CONTROL ====================
    start() {
        if (this.active && !this.over) return;
        
        this.reset();
        this.active = true;
        this.paused = false;
        this.over = false;
        
        this.current = this.newPiece();
        this.next = this.newPiece();
        
        this.updateUI();
        this.lastTime = performance.now();
        this.lastSecond = performance.now();
        this.gameLoop();
    }
    
    pause() {
        if (!this.active || this.over) return;
        
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
            this.lastSecond = performance.now();
            this.gameLoop();
        }
    }
    
    endGame(isWin = false) {
        this.active = false;
        this.over = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.updateUI();
    }
    
    // ==================== GAME LOOP ====================
    gameLoop(time = 0) {
        if (!this.active || this.over) {
            this.animationFrameId = null;
            return;
        }
        
        // Update DAS/ARR
        this.updateDAS(time);
        
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        
        if (!this.paused) {
            // Update game time
            if (time - this.lastSecond >= 1000) {
                this.time++;
                this.lastSecond = time;
                this.updateUI();
            }
            
            // Gravity with lock delay
            this.dropCounter += deltaTime;
            if (this.dropCounter > this.speed) {
                this.current.y++;
                if (this.collision()) {
                    this.current.y--;
                    this.lockTimer += deltaTime;
                    if (this.lockTimer >= this.lockDelay) {
                        this.placePiece();
                    }
                } else {
                    this.lockTimer = 0; // Reset lock timer on successful move
                }
                this.dropCounter = 0;
            }
            
            // Soft drop with adjustable speed
            if (this.keys[this.controls.down]) {
            this.dropCounter += deltaTime * this.softDropSpeed;  // Uses adjustable speed    
            if (this.dropCounter > this.speed / this.softDropSpeed) {
        this.current.y++;
        if (this.collision()) {
            this.current.y--;
            this.lockTimer += 33;
        } else {
            this.lockTimer = 0;
        }
        this.dropCounter = 0;
    }
}
            
            // Draw everything
            this.draw();
            this.drawNext();
            this.drawHold();
        }
        
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    // ==================== DRAWING ====================
    draw() {
        const canvas = document.getElementById('game');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const size = this.SIZE;
        
        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw board (settled pieces)
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                if (this.board[y][x]) {
                    ctx.fillStyle = this.COLORS[this.board[y][x] - 1];
                    ctx.fillRect(x * size, y * size, size, size);
                    
                    // Highlight
                    ctx.fillStyle = '#ffffff30';
                    ctx.fillRect(x * size, y * size, size - 1, 2);
                    ctx.fillRect(x * size, y * size, 2, size - 1);
                    
                    // Border
                    ctx.strokeStyle = '#00000040';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * size, y * size, size, size);
                }
            }
        }
        
        // Draw ghost piece (if enabled and piece exists)
        if (this.ghost && this.current) {
            const ghost = {
                ...this.current,
                y: this.current.y,
                matrix: this.current.matrix.map(row => [...row])
            };
            
            while (!this.collision(ghost)) {
                ghost.y++;
            }
            ghost.y--;
            
            ctx.strokeStyle = '#ffffff80';
            ctx.lineWidth = 2;
            for (let y = 0; y < ghost.matrix.length; y++) {
                for (let x = 0; x < ghost.matrix[y].length; x++) {
                    if (ghost.matrix[y][x]) {
                        ctx.strokeRect(
                            (ghost.x + x) * size + 1,
                            (ghost.y + y) * size + 1,
                            size - 2,
                            size - 2
                        );
                    }
                }
            }
        }
        
        // Draw current piece (if exists)
        if (this.current) {
            for (let y = 0; y < this.current.matrix.length; y++) {
                for (let x = 0; x < this.current.matrix[y].length; x++) {
                    if (this.current.matrix[y][x]) {
                        ctx.fillStyle = this.COLORS[this.current.type];
                        ctx.fillRect(
                            (this.current.x + x) * size,
                            (this.current.y + y) * size,
                            size,
                            size
                        );
                        
                        // Highlight
                        ctx.fillStyle = '#ffffff30';
                        ctx.fillRect(
                            (this.current.x + x) * size,
                            (this.current.y + y) * size,
                            size - 1,
                            2
                        );
                        ctx.fillRect(
                            (this.current.x + x) * size,
                            (this.current.y + y) * size,
                            2,
                            size - 1
                        );
                        
                        // Border
                        ctx.strokeStyle = '#00000040';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(
                            (this.current.x + x) * size,
                            (this.current.y + y) * size,
                            size,
                            size
                        );
                    }
                }
            }
        }
        
        // Draw grid
        ctx.strokeStyle = '#ffffff10';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= this.COLS; x++) {
            ctx.beginPath();
            ctx.moveTo(x * size, 0);
            ctx.lineTo(x * size, this.ROWS * size);
            ctx.stroke();
        }
        for (let y = 0; y <= this.ROWS; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * size);
            ctx.lineTo(this.COLS * size, y * size);
            ctx.stroke();
        }
    }
    
    drawNext() {
        const canvas = document.getElementById('next');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!this.next) return;
        
        this.drawPiecePreview(ctx, this.next);
    }
    
    drawHold() {
        const canvas = document.getElementById('hold');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (this.hold === null) return;
        
        const piece = { 
            type: this.hold, 
            matrix: this.PIECES[this.hold] 
        };
        this.drawPiecePreview(ctx, piece);
    }
    
    drawPiecePreview(ctx, piece) {
        const matrix = piece.matrix;
        const color = this.COLORS[piece.type];
        const blockSize = 25;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        const offsetX = (width - matrix[0].length * blockSize) / 2;
        const offsetY = (height - matrix.length * blockSize) / 2;
        
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) {
                    const screenX = offsetX + x * blockSize;
                    const screenY = offsetY + y * blockSize;
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(screenX, screenY, blockSize, blockSize);
                    
                    ctx.strokeStyle = '#00000040';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(screenX, screenY, blockSize, blockSize);
                }
            }
        }
    }
    
    // ==================== UI ====================
    updateUI() {
        const scoreEl = document.getElementById('score');
        const linesEl = document.getElementById('lines');
        const levelEl = document.getElementById('level');
        const timeEl = document.getElementById('time');
        const ppsEl = document.getElementById('pps');
        const piecesEl = document.getElementById('pieces-count');
        const progressEl = document.getElementById('progress');
        const statusEl = document.getElementById('status');
        
        if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
        if (linesEl) linesEl.textContent = this.lines;
        if (levelEl) levelEl.textContent = this.level;
        if (piecesEl) piecesEl.textContent = this.piecesPlaced;
        
        if (timeEl) {
            const minutes = Math.floor(this.time / 60);
            const seconds = this.time % 60;
            timeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (ppsEl && this.time > 0) {
            const pps = (this.piecesPlaced / this.time).toFixed(2);
            ppsEl.textContent = pps;
        }
        
        if (progressEl) {
            const progress = Math.min(100, (this.lines / 40) * 100);
            progressEl.style.width = `${progress}%`;
        }
        
        if (statusEl) {
            if (this.over) {
                statusEl.textContent = this.lines >= 40 ? '40 Lines Cleared!' : 'Game Over';
                statusEl.style.color = this.lines >= 40 ? '#4CAF50' : '#f44336';
            } else if (this.paused) {
                statusEl.textContent = 'Paused';
                statusEl.style.color = '#FF9800';
            } else if (this.active) {
                statusEl.textContent = 'Playing';
                statusEl.style.color = '#4CAF50';
            } else {
                statusEl.textContent = 'Ready';
                statusEl.style.color = '#fff';
            }
        }
    }
    
    // ==================== INITIALIZATION ====================
    createUI() {
        if (!document.getElementById('game')) {
            document.body.innerHTML = `
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: monospace; }
                    body { background: #111; color: white; padding: 20px; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
                    .container { display: flex; gap: 20px; max-width: 1000px; flex-wrap: wrap; }
                    .panel { background: #1a1a1a; border: 1px solid #333; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
                    .title { color: #888; font-size: 12px; margin-bottom: 5px; text-transform: uppercase; }
                    .value { font-size: 24px; font-weight: bold; }
                    .progress { height: 4px; background: #222; margin-top: 8px; border-radius: 2px; }
                    .progress-fill { height: 100%; background: #4CAF50; width: 0%; border-radius: 2px; }
                    #game { background: #000; border: 2px solid #333; display: block; }
                    button { background: #222; border: 1px solid #333; color: white; padding: 10px; cursor: pointer; width: 100%; margin-top: 5px; border-radius: 4px; transition: background 0.2s; }
                    button:hover { background: #2a2a2a; }
                    .primary { border-color: #4CAF50; color: #4CAF50; font-weight: bold; }
                    #status { text-align: center; margin-bottom: 10px; height: 20px; font-weight: bold; }
                    .controls-info { font-size: 11px; color: #666; line-height: 1.4; margin-top: 5px; }
                    #modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; z-index: 1000; }
                    .modal-content { background: #222; border: 1px solid #333; padding: 25px; width: 400px; max-width: 90%; border-radius: 8px; }
                    .modal-content h3 { color: white; margin: 0 0 20px 0; border-bottom: 1px solid #444; padding-bottom: 10px; }
                    .key-display { background: #444; color: white; padding: 6px 12px; min-width: 80px; text-align: center; border-radius: 4px; }
                    input[type="range"] { width: 100%; margin: 10px 0; background: #333; height: 6px; border-radius: 3px; }
                    input[type="range"]::-webkit-slider-thumb { background: #4CAF50; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; }
                    .range-label { color: #ccc; margin: 10px 0 5px 0; display: flex; justify-content: space-between; }
                    .control-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #333; }
                    .control-label { color: white; font-size: 14px; }
                </style>
                
                <div class="container">
                    <!-- Left Panel -->
                    <div>
                        <div class="panel">
                            <div class="title">Hold</div>
                            <canvas id="hold" width="100" height="100"></canvas>
                        </div>
                        <div class="panel">
                            <div class="title">Score</div>
                            <div id="score" class="value">0</div>
                        </div>
                        <div class="panel">
                            <div class="title">Lines</div>
                            <div id="lines" class="value">0</div>
                            <div class="progress">
                                <div id="progress" class="progress-fill"></div>
                            </div>
                        </div>
                        <button id="controls-btn">Controls Settings</button>
                    </div>
                    
                    <!-- Center -->
                    <div>
                        <div id="status">Ready</div>
                        <canvas id="game" width="300" height="600"></canvas>
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button id="start-btn" class="primary">Start Game</button>
                            <button id="pause-btn">Pause/Resume</button>
                            <button id="reset-btn">Reset</button>
                        </div>
                    </div>
                    
                    <!-- Right Panel -->
                    <div>
                        <div class="panel">
                            <div class="title">Next</div>
                            <canvas id="next" width="100" height="100"></canvas>
                        </div>
                        <div class="panel">
                            <div class="title">Time</div>
                            <div id="time" class="value">00:00</div>
                        </div>
                        <div class="panel">
                            <div class="title">Pieces Per Second</div>
                            <div id="pps" class="value">0.00</div>
                            <div class="controls-info">Pieces Placed: <span id="pieces-count">0</span></div>
                        </div>
                        <div class="panel">
                            <div class="title">Controls</div>
                            <div class="controls-info">
                                ←→ : Move (DAS/ARR)<br>
                                ↑ : Rotate Clockwise<br>
                                Z : Rotate Counter-Clockwise<br>
                                A : Rotate 180°<br>
                                ↓ : Soft Drop<br>
                                Space : Hard Drop<br>
                                C : Hold Piece<br>
                                P : Pause Game
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Controls Modal -->
                <div id="modal">
                    <div class="modal-content">
                        <h3>Controls Settings</h3>
                        <div id="controls-list"></div>
                        
                        <div class="range-label">
                            <span>DAS (Delayed Auto Shift)</span>
                            <span id="das-value">133ms</span>
                        </div>
                        <input type="range" id="das-slider" min="50" max="300" value="133">
                        
                        <div class="range-label">
                            <span>ARR (Auto Repeat Rate)</span>
                            <span id="arr-value">33ms</span>
                        </div>
                        <input type="range" id="arr-slider" min="0" max="100" value="33">
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button id="save-controls" style="flex: 1; background: #4CAF50; border: none; color: white; padding: 12px;">Save Settings</button>
                            <button id="close-modal" style="flex: 1; background: #666; border: none; color: white; padding: 12px;">Close</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    setupEvents() {
        // Game buttons
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('pause-btn').addEventListener('click', () => this.pause());
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.reset();
            this.draw();
            this.updateUI();
        });
        
        // Controls modal
        document.getElementById('controls-btn').addEventListener('click', () => this.showControls());
        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('modal').style.display = 'none';
        });
        document.getElementById('save-controls').addEventListener('click', () => {
            localStorage.setItem('tetris-controls', JSON.stringify(this.controls));
            document.getElementById('modal').style.display = 'none';
        });
        
        // DAS/ARR sliders
        document.getElementById('das-slider').addEventListener('input', (e) => {
            this.DAS = parseInt(e.target.value);
            document.getElementById('das-value').textContent = this.DAS + 'ms';
        });
        
        document.getElementById('arr-slider').addEventListener('input', (e) => {
            this.ARR = parseInt(e.target.value);
            document.getElementById('arr-value').textContent = this.ARR + 'ms';
        });
        document.getElementById('softdrop-slider').addEventListener('input', (e) => {
            this.softDropSpeed = parseInt(e.target.value);
            document.getElementById('softdrop-value').textContent = this.softDropSpeed + 'x';
});
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.keyCode] = true;
            
            if (e.keyCode === this.controls.rotate) this.rotate(1);
            if (e.keyCode === this.controls.ccw) this.rotate(-1);
            if (e.keyCode === this.controls.rot180) {
                this.rotate(1);
                this.rotate(1); // Two CW rotations = 180
            }
            if (e.keyCode === this.controls.hard) this.hardDrop();
            if (e.keyCode === this.controls.hold) this.holdPiece();
            if (e.keyCode === this.controls.pause) this.pause();
            
            if (Object.values(this.controls).includes(e.keyCode)) {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });
        
        // Close modal on ESC
        document.addEventListener('keydown', (e) => {
            if (e.keyCode === 27) { // ESC
                document.getElementById('modal').style.display = 'none';
            }
        });
    }
    
    showControls() {
        document.getElementById('das-slider').value = this.DAS;
        document.getElementById('arr-slider').value = this.ARR;
        document.getElementById('das-value').textContent = this.DAS + 'ms';
        document.getElementById('arr-value').textContent = this.ARR + 'ms';
        
        const controls = [
            {key: 'left', label: 'Move Left'},
            {key: 'right', label: 'Move Right'},
            {key: 'rotate', label: 'Rotate Clockwise'},
            {key: 'ccw', label: 'Rotate Counter-Clockwise'},
            {key: 'rot180', label: 'Rotate 180°'},
            {key: 'down', label: 'Soft Drop'},
            {key: 'hard', label: 'Hard Drop'},
            {key: 'hold', label: 'Hold Piece'},
            {key: 'pause', label: 'Pause Game'}
        ];
        
        const listHTML = controls.map(c => `
            <div class="control-item">
                <div class="control-label">${c.label}</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div id="key-${c.key}" class="key-display">
                        ${this.getKeyName(this.controls[c.key])}
                    </div>
                    <button onclick="tetris.changeKey('${c.key}')" style="background: #555; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
                        Change
                    </button>
                </div>
            </div>
        `).join('');
        const sliderHTML = `
    <div class="range-label">
    <span>Soft Drop Speed</span>
    <span id="softdrop-value">10x</span>
    </div>
    <input type="range" id="softdrop-slider" min="1" max="20" value="10">
`;

        document.getElementById('controls-list').innerHTML = listHTML + sliderHTML;
        document.getElementById('controls-list').innerHTML = listHTML;
        document.getElementById('modal').style.display = 'flex';
    }
    
    changeKey(action) {
        const msg = document.createElement('div');
        msg.style.cssText = 'background: #444; color: #4CAF50; padding: 12px; margin: 10px 0; text-align: center; border-radius: 4px;';
        msg.textContent = `Press any key for ${action}...`;
        
        document.getElementById('controls-list').prepend(msg);
        
        const listener = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.controls[action] = e.keyCode;
            document.removeEventListener('keydown', listener);
            this.showControls();
        };
        
        document.addEventListener('keydown', listener, {once: true});
    }
    
    getKeyName(code) {
        const names = {
            8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt',
            27: 'Esc', 32: 'Space', 37: '←', 38: '↑', 39: '→', 40: '↓',
            65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H',
            73: 'I', 74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P',
            81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X',
            89: 'Y', 90: 'Z'
        };
        return names[code] || `Key ${code}`;
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.tetris = new Tetris();
});