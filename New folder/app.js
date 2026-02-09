        // Game constants
        const COLS = 10, ROWS = 20, BLOCK_SIZE = 30;
        const COLORS = [null, '#00FFFF', '#0000FF', '#FF8000', '#FFFF00', '#00FF00', '#800080', '#FF0000'];
        const SHAPES = [null, [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], [[2,0,0],[2,2,2],[0,0,0]], [[0,0,3],[3,3,3],[0,0,0]], [[4,4],[4,4]], [[0,5,5],[5,5,0],[0,0,0]], [[0,6,0],[6,6,6],[0,0,0]], [[7,7,0],[0,7,7],[0,0,0]]];
        
        // SRS Kick Tables
        const SRS_KICK_TABLES = {
            I: { 0:{R:[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],L:[[0,0],[2,0],[-1,0],[2,1],[-1,-2]]}, R:{0:[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],2:[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]}, 2:{R:[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],L:[[0,0],[2,0],[-1,0],[2,1],[-1,-2]]}, L:{0:[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],2:[[0,0],[1,0],[-2,0],[1,-2],[-2,1]]}},
            JLSTZ: { 0:{R:[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],L:[[0,0],[1,0],[1,1],[0,-2],[1,-2]]}, R:{0:[[0,0],[1,0],[1,-1],[0,2],[1,2]],2:[[0,0],[1,0],[1,-1],[0,2],[1,2]]}, 2:{R:[[0,0],[1,0],[1,-1],[0,2],[1,2]],L:[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]}, L:{0:[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],2:[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]}}
        };
        
        // Game variables
        let canvas = document.getElementById('tetris'), ctx = canvas.getContext('2d');
        let nextCanvas = document.getElementById('next-piece'), nextCtx = nextCanvas.getContext('2d');
        let holdCanvas = document.getElementById('hold-piece'), holdCtx = holdCanvas.getContext('2d');
        let board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
        let score = 0, linesCleared = 0, level = 1, gameTime = 0, piecesPlaced = 0, gameActive = false, gamePaused = false, gameOver = false, gameMode = 'endless';
        let dropCounter = 0, dropInterval = 1000, lastTime = 0, ghostEnabled = true;
        let bag = [], nextPiece = null, currentPiece = null, heldPiece = null, canHold = true;
        let stats = {single:0, double:0, triple:0, tetris:0};
        let DAS = 133, ARR = 33, keys = {}, dasTimers = {};
        let rotationState = 0;
        
        // UI Elements
        const scoreEl = document.getElementById('score'), linesEl = document.getElementById('lines'), levelEl = document.getElementById('level');
        const timeEl = document.getElementById('game-time'), ppsEl = document.getElementById('pps'), piecesEl = document.getElementById('pieces-count');
        const statusEl = document.getElementById('game-status'), progressEl = document.getElementById('progress-fill');
        const statEls = ['single','double','triple','tetris'].map(id => document.getElementById(`stat-${id}`));
        
        // Controls Manager
        const KEY_NAMES = {8:"Backspace",9:"Tab",13:"Enter",16:"Shift",17:"Ctrl",18:"Alt",27:"Esc",32:"Space",37:"←",38:"↑",39:"→",40:"↓",65:"A",67:"C",80:"P",90:"Z"};
        const DEFAULT_CONTROLS = {MOVE_LEFT:37, MOVE_RIGHT:39, ROTATE_CW:38, ROTATE_CCW:90, ROTATE_180:65, SOFT_DROP:40, HARD_DROP:32, HOLD:67, PAUSE:80};
        let controls = JSON.parse(localStorage.getItem('tetris_controls')) || {...DEFAULT_CONTROLS};
        let isListening = false, currentAction = null;
        
        // Initialize
        drawBoard();
        
        // Game functions
        function createBag() { 
            const newBag = [1,2,3,4,5,6,7]; 
            for (let i = newBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
            }
            return newBag;
        }
        
        function getNextPiece() { 
            if (bag.length === 0) bag = createBag(); 
            return bag.shift(); 
        }
        
        function createPiece(type) {
            return { pos: {x: Math.floor(COLS/2)-1, y: 0}, matrix: SHAPES[type], type: type };
        }
        
        function calculateGhostPosition() {
            if (!currentPiece || !ghostEnabled) return null;
            let ghost = { pos: {...currentPiece.pos}, matrix: currentPiece.matrix, type: currentPiece.type };
            while (!collide(board, ghost)) ghost.pos.y++;
            ghost.pos.y--;
            return ghost;
        }
        
        function drawBlock(ctx, x, y, color, isGhost = false) {
            const sx = x * BLOCK_SIZE, sy = y * BLOCK_SIZE;
            if (isGhost) {
                ctx.strokeStyle = color + '80';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx + 1, sy + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                ctx.fillStyle = color + '80';
                ctx.fillRect(sx, sy, 3, 3);
                ctx.fillRect(sx + BLOCK_SIZE - 3, sy, 3, 3);
                ctx.fillRect(sx, sy + BLOCK_SIZE - 3, 3, 3);
                ctx.fillRect(sx + BLOCK_SIZE - 3, sy + BLOCK_SIZE - 3, 3, 3);
                return;
            }
            ctx.fillStyle = color;
            ctx.fillRect(sx, sy, BLOCK_SIZE, BLOCK_SIZE);
            ctx.fillStyle = '#ffffff30';
            ctx.fillRect(sx, sy, BLOCK_SIZE - 1, 2);
            ctx.fillRect(sx, sy, 2, BLOCK_SIZE - 1);
            ctx.strokeStyle = '#00000040';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, BLOCK_SIZE, BLOCK_SIZE);
        }
        
        function drawBoard() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            board.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) drawBlock(ctx, x, y, COLORS[value]);
                });
            });
            const ghost = calculateGhostPosition();
            if (ghost) {
                ghost.matrix.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value !== 0) drawBlock(ctx, ghost.pos.x + x, ghost.pos.y + y, COLORS[ghost.type], true);
                    });
                });
            }
            if (currentPiece) {
                currentPiece.matrix.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value !== 0) drawBlock(ctx, currentPiece.pos.x + x, currentPiece.pos.y + y, COLORS[currentPiece.type]);
                    });
                });
            }
            ctx.strokeStyle = '#ffffff10';
            ctx.lineWidth = 0.5;
            for (let x = 0; x <= COLS; x++) {
                ctx.beginPath();
                ctx.moveTo(x * BLOCK_SIZE, 0);
                ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
                ctx.stroke();
            }
            for (let y = 0; y <= ROWS; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * BLOCK_SIZE);
                ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
                ctx.stroke();
            }
        }
        
        function drawNextPiece() {
            nextCtx.fillStyle = '#111';
            nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
            if (!nextPiece) return;
            const offsetX = (4 - nextPiece.matrix[0].length) * 12.5;
            const offsetY = (4 - nextPiece.matrix.length) * 12.5;
            nextPiece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const sx = offsetX + x * 25, sy = offsetY + y * 25;
                        nextCtx.fillStyle = COLORS[nextPiece.type];
                        nextCtx.fillRect(sx, sy, 25, 25);
                        nextCtx.strokeStyle = '#00000040';
                        nextCtx.lineWidth = 1;
                        nextCtx.strokeRect(sx, sy, 25, 25);
                    }
                });
            });
        }
        
        function drawHeldPiece() {
            holdCtx.fillStyle = '#111';
            holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
            if (!heldPiece) return;
            const pieceType = heldPiece;
            const matrix = SHAPES[pieceType];
            const offsetX = (4 - matrix[0].length) * 12.5;
            const offsetY = (4 - matrix.length) * 12.5;
            matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const sx = offsetX + x * 25, sy = offsetY + y * 25;
                        holdCtx.fillStyle = COLORS[pieceType];
                        holdCtx.fillRect(sx, sy, 25, 25);
                        holdCtx.strokeStyle = '#00000040';
                        holdCtx.lineWidth = 1;
                        holdCtx.strokeRect(sx, sy, 25, 25);
                    }
                });
            });
            if (!canHold) {
                holdCtx.fillStyle = 'rgba(0,0,0,0.7)';
                holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
                holdCtx.fillStyle = '#888';
                holdCtx.font = 'bold 12px monospace';
                holdCtx.textAlign = 'center';
                holdCtx.textBaseline = 'middle';
                holdCtx.fillText('USED', holdCanvas.width/2, holdCanvas.height/2);
            }
        }
        
        function collide(board, piece) {
            const [m, o] = [piece.matrix, piece.pos];
            for (let y = 0; y < m.length; y++) {
                for (let x = 0; x < m[y].length; x++) {
                    if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) return true;
                }
            }
            return false;
        }
        
        function merge(board, piece) {
            piece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) board[y + piece.pos.y][x + piece.pos.x] = piece.type;
                });
            });
        }
        
        function rotateMatrixCW(matrix) {
            const N = matrix.length;
            const result = Array.from({length: N}, () => Array(N).fill(0));
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    result[j][N-1-i] = matrix[i][j];
                }
            }
            return result;
        }
        
        function rotateMatrixCCW(matrix) {
            const N = matrix.length;
            const result = Array.from({length: N}, () => Array(N).fill(0));
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    result[N-1-j][i] = matrix[i][j];
                }
            }
            return result;
        }
        
        function rotatePiece(piece, direction) {
            if (!piece || piece.type === 4) return piece;
            const originalMatrix = piece.matrix.map(r => [...r]);
            const originalPos = {...piece.pos};
            let newState;
            if (direction === 2) {
                // 180 rotation
                piece.matrix = rotateMatrixCW(rotateMatrixCW(originalMatrix));
                newState = (rotationState + 2) % 4;
            } else if (direction === 1) {
                piece.matrix = rotateMatrixCW(originalMatrix);
                newState = (rotationState + 1) % 4;
            } else {
                piece.matrix = rotateMatrixCCW(originalMatrix);
                newState = (rotationState + 3) % 4;
            }
            const kickTable = piece.type === 1 ? SRS_KICK_TABLES.I : SRS_KICK_TABLES.JLSTZ;
            const stateNames = ['0','R','2','L'];
            const kicks = direction === 1 ? 
                (kickTable[stateNames[rotationState]]?.R || [[0,0]]) : 
                (kickTable[stateNames[rotationState]]?.L || [[0,0]]);
            for (const kick of kicks) {
                piece.pos.x = originalPos.x + kick[0];
                piece.pos.y = originalPos.y + kick[1];
                if (!collide(board, piece)) {
                    rotationState = newState;
                    return piece;
                }
            }
            piece.matrix = originalMatrix;
            piece.pos = originalPos;
            return piece;
        }
        
        function movePiece(dir) {
            if (!gameActive || gamePaused || gameOver) return;
            currentPiece.pos.x += dir;
            if (collide(board, currentPiece)) currentPiece.pos.x -= dir;
            drawBoard();
        }
        
        function rotateCurrentPiece(dir) {
            if (!gameActive || gamePaused || gameOver) return;
            rotatePiece(currentPiece, dir);
            drawBoard();
        }
        
        function dropPiece() {
            if (!gameActive || gamePaused || gameOver) return;
            currentPiece.pos.y++;
            if (collide(board, currentPiece)) {
                currentPiece.pos.y--;
                merge(board, currentPiece);
                piecesPlaced++;
                resetPiece();
                clearLines();
                updateGameStats();
            }
            dropCounter = 0;
            drawBoard();
        }
        
        function hardDropPiece() {
            if (!gameActive || gamePaused || gameOver) return;
            while (!collide(board, currentPiece)) currentPiece.pos.y++;
            currentPiece.pos.y--;
            merge(board, currentPiece);
            piecesPlaced++;
            resetPiece();
            clearLines();
            updateGameStats();
            drawBoard();
        }
        
        function holdPiece() {
            if (!gameActive || gamePaused || gameOver || !canHold) return;
            if (!heldPiece) {
                heldPiece = currentPiece.type;
                resetPiece();
            } else {
                const temp = currentPiece.type;
                currentPiece.type = heldPiece;
                currentPiece.matrix = SHAPES[heldPiece];
                heldPiece = temp;
                currentPiece.pos = {x: Math.floor(COLS/2)-1, y: 0};
                rotationState = 0;
                if (collide(board, currentPiece)) endGame();
            }
            canHold = false;
            drawHeldPiece();
            drawBoard();
        }
        
        function resetPiece() {
            currentPiece = nextPiece;
            nextPiece = createPiece(getNextPiece());
            rotationState = 0;
            canHold = true;
            if (collide(board, currentPiece)) endGame();
            drawNextPiece();
            drawHeldPiece();
        }
        
        function clearLines() {
            let linesClearedThisMove = 0;
            outer: for (let y = ROWS - 1; y >= 0; y--) {
                for (let x = 0; x < COLS; x++) {
                    if (board[y][x] === 0) continue outer;
                }
                const row = board.splice(y, 1)[0].fill(0);
                board.unshift(row);
                y++;
                linesClearedThisMove++;
                linesCleared++;
            }
            if (linesClearedThisMove > 0) {
                if (linesClearedThisMove === 1) stats.single++;
                else if (linesClearedThisMove === 2) stats.double++;
                else if (linesClearedThisMove === 3) stats.triple++;
                else if (linesClearedThisMove === 4) stats.tetris++;
                const linePoints = [0, 100, 300, 500, 800];
                score += linePoints[linesClearedThisMove] * level;
                level = Math.floor(linesCleared / 10) + 1;
                dropInterval = Math.max(50, 1000 - (level - 1) * 50);
                if (gameMode === '40lines' && linesCleared >= 40) endGame(true);
                updateStats();
            }
        }
        
        function updateGameStats() {
            scoreEl.textContent = score.toLocaleString();
            linesEl.textContent = linesCleared;
            levelEl.textContent = level;
            piecesEl.textContent = piecesPlaced;
            const minutes = Math.floor(gameTime / 60);
            const seconds = gameTime % 60;
            timeEl.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
            if (gameTime > 0) ppsEl.textContent = (piecesPlaced / gameTime).toFixed(2);
            const progress = Math.min(100, (linesCleared / 40) * 100);
            progressEl.style.width = `${progress}%`;
        }
        
        function updateStats() {
            statEls[0].textContent = stats.single;
            statEls[1].textContent = stats.double;
            statEls[2].textContent = stats.triple;
            statEls[3].textContent = stats.tetris;
        }
        
        function updateTimer() {
            if (gameActive && !gamePaused && !gameOver) {
                gameTime++;
                updateGameStats();
            }
        }
        
        function gameLoop(time = 0) {
            if (!gameActive || gameOver) return;
            
            // DAS/ARR Movement
            const now = Date.now();
            [controls.MOVE_LEFT, controls.MOVE_RIGHT].forEach((keyCode, idx) => {
                if (!keys[keyCode]) return;
                const held = now - (dasTimers[keyCode] || now);
                if (held < DAS) return;
                const moves = 1 + Math.floor((held - DAS) / ARR);
                movePiece(idx === 0 ? -Math.min(moves, 3) : Math.min(moves, 3));
            });
            
            const deltaTime = time - lastTime;
            lastTime = time;
            
            if (!gamePaused) {
                dropCounter += deltaTime;
                if (dropCounter > dropInterval) dropPiece();
                drawBoard();
            }
            
            requestAnimationFrame(gameLoop);
        }
        
        function startGame() {
            if (gameActive && !gameOver) return;
            resetGame();
            gameActive = true;
            gamePaused = false;
            gameOver = false;
            bag = createBag();
            currentPiece = createPiece(getNextPiece());
            nextPiece = createPiece(getNextPiece());
            drawNextPiece();
            drawHeldPiece();
            gameTimer = setInterval(updateTimer, 1000);
            statusEl.textContent = 'Playing';
            statusEl.className = 'game-status playing';
            startBtn.textContent = 'Restart';
            lastTime = 0;
            requestAnimationFrame(gameLoop);
        }
        
        function pauseGame() {
            if (!gameActive || gameOver) return;
            gamePaused = !gamePaused;
            if (gamePaused) {
                statusEl.textContent = 'Paused';
                statusEl.className = 'game-status';
                pauseBtn.textContent = 'Resume';
            } else {
                statusEl.textContent = 'Playing';
                statusEl.className = 'game-status playing';
                pauseBtn.textContent = 'Pause';
                lastTime = performance.now();
                requestAnimationFrame(gameLoop);
            }
        }
        
        function resetGame() {
            board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
            score = 0; linesCleared = 0; level = 1; gameTime = 0; piecesPlaced = 0; dropInterval = 1000;
            stats = {single:0, double:0, triple:0, tetris:0};
            heldPiece = null; canHold = true;
            if (gameTimer) clearInterval(gameTimer);
            updateGameStats(); updateStats();
            statusEl.textContent = 'Ready';
            statusEl.className = 'game-status';
            startBtn.textContent = 'Start';
            pauseBtn.textContent = 'Pause';
            drawBoard(); drawNextPiece(); drawHeldPiece();
        }
        
        function endGame(isWin = false) {
            gameActive = false;
            gameOver = true;
            if (gameTimer) clearInterval(gameTimer);
            statusEl.textContent = isWin ? '40 Lines Cleared!' : 'Game Over';
            statusEl.className = isWin ? 'game-status playing' : 'game-status';
        }
        
        function setGameMode(mode) {
            gameMode = mode;
            document.getElementById('mode-endless').classList.toggle('active', mode === 'endless');
            document.getElementById('mode-40lines').classList.toggle('active', mode === '40lines');
            if (gameActive) resetGame();
        }
        
        // Controls Customizer
        function setupControlsUI() {
    const overlay = document.getElementById('controls-overlay');
    const modal = document.getElementById('controls-modal');
    
    function updateControlsList() {
        const container = document.getElementById('controls-list');
        const actions = [
            {key:'MOVE_LEFT', label:'Move Left'},
            {key:'MOVE_RIGHT', label:'Move Right'},
            {key:'ROTATE_CW', label:'Rotate CW'},
            {key:'ROTATE_CCW', label:'Rotate CCW'},
            {key:'ROTATE_180', label:'Rotate 180°'},
            {key:'SOFT_DROP', label:'Soft Drop'},
            {key:'HARD_DROP', label:'Hard Drop'},
            {key:'HOLD', label:'Hold'},
            {key:'PAUSE', label:'Pause'}
        ];
        
        container.innerHTML = actions.map(action => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #222;">
                <div style="font-size: 13px; color: #fff;">${action.label}</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div id="key-${action.key}" style="background: #222; border: 1px solid #333; color: #fff; padding: 4px 12px; font-size: 12px; font-family: monospace; border-radius: 2px; min-width: 60px; text-align: center;">
                        ${KEY_NAMES[controls[action.key]] || controls[action.key]}
                    </div>
                    <button data-action="${action.key}" style="background: #2a2a2a; border: 1px solid #444; color: #fff; padding: 4px 12px; font-size: 11px; cursor: pointer; border-radius: 2px;">
                        Change
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click listeners
        container.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                startKeyAssignment(action);
            });
        });
    }
    
container.innerHTML = actions.map(action => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #222;">
        <div style="font-size: 13px; color: #fff;">${action.label}</div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <div id="key-${action.key}" style="background: #222; border: 1px solid #333; color: #fff; padding: 4px 12px; font-size: 12px; font-family: monospace; border-radius: 2px; min-width: 60px; text-align: center;">
                ${KEY_NAMES[controls[action.key]] || controls[action.key]}
            </div>
            <button data-action="${action.key}" style="background: #2a2a2a; border: 1px solid #444; color: #fff; padding: 4px 12px; font-size: 11px; cursor: pointer; border-radius: 2px;">
                Change
            </button>
        </div>
    </div>
`).join('');
}
