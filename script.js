class CandyRushGame {
    constructor() {
        this.board = [];
        this.boardSize = 8;
        this.candyTypes = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
        this.score = 0;
        this.selectedCandy = null;
        this.isAnimating = false;
        
        // Level progression system
        this.floor = 1;
        this.level = 1;
        this.baseScore = 100;
        this.targetScore = 100;
        
        // Draining score system
        this.isDraining = false;
        this.drainInterval = null;
        this.drainRate = 10; // Initial points drained per second
        this.maxDrainRate = 10; // Maximum drain rate based on level/floor
        this.levelStartTime = null; // Track when level started
        this.lastDrainIncrease = 0; // Track when drain rate was last increased
        
        // DOM elements
        this.gameBoard = document.getElementById('gameBoard');
        this.scoreElement = document.getElementById('score');
        this.targetScoreElement = document.getElementById('targetScore');
        this.floorElement = document.getElementById('floor');
        this.levelElement = document.getElementById('level');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.particlesContainer = document.getElementById('particlesContainer');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.levelCompleteModal = document.getElementById('levelCompleteModal');
        
        this.initializeBoard();
        this.setupEventListeners();
        this.renderBoard();
        this.updateUI();
    }

    initializeBoard() {
        // Create empty board
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        
        // Fill board with candies, ensuring no initial matches
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                let candyType;
                do {
                    candyType = this.candyTypes[Math.floor(Math.random() * this.candyTypes.length)];
                } while (this.wouldCreateMatch(row, col, candyType));
                
                this.board[row][col] = candyType;
            }
        }
    }

    wouldCreateMatch(row, col, candyType) {
        // Check horizontal match
        if (col >= 2 && 
            this.board[row][col - 1] === candyType && 
            this.board[row][col - 2] === candyType) {
            return true;
        }
        
        // Check vertical match
        if (row >= 2 && 
            this.board[row - 1][col] === candyType && 
            this.board[row - 2][col] === candyType) {
            return true;
        }
        
        return false;
    }

    setupEventListeners() {
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
        document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.newGame());
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
        
        // Touch and mouse events for drag and drop
        this.gameBoard.addEventListener('mousedown', (e) => this.handleStart(e));
        this.gameBoard.addEventListener('mousemove', (e) => this.handleMove(e));
        this.gameBoard.addEventListener('mouseup', (e) => this.handleEnd(e));
        
        this.gameBoard.addEventListener('touchstart', (e) => this.handleStart(e));
        this.gameBoard.addEventListener('touchmove', (e) => this.handleMove(e));
        this.gameBoard.addEventListener('touchend', (e) => this.handleEnd(e));
        
        // Prevent default drag behavior
        this.gameBoard.addEventListener('dragstart', (e) => e.preventDefault());
    }

    calculateTargetScore() {
        // Base score starts at 100
        let baseScore = 100;
        
        // Apply floor multiplier (2.5x for each new floor)
        if (this.floor > 1) {
            baseScore = Math.floor(100 * Math.pow(2.5, this.floor - 1));
        }
        
        // Apply level multipliers within the floor
        let target = baseScore;
        if (this.level === 2) {
            target = Math.floor(baseScore * 1.5); // 1.5x for second level
        } else if (this.level === 3) {
            target = baseScore * 2; // 2x for third level
        }
        
        return target;
    }

    checkLevelComplete() {
        if (this.score >= this.targetScore) {
            this.levelComplete();
            return true;
        }
        return false;
    }

    renderBoard() {
        this.gameBoard.innerHTML = '';
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const candy = document.createElement('div');
                candy.className = `candy ${this.board[row][col]}`;
                candy.dataset.type = this.board[row][col];
                
                cell.appendChild(candy);
                this.gameBoard.appendChild(cell);
            }
        }
    }

    handleStart(e) {
        if (this.isAnimating) return;
        
        e.preventDefault();
        const target = e.target.closest('.cell');
        if (!target) return;
        
        const row = parseInt(target.dataset.row);
        const col = parseInt(target.dataset.col);
        
        const candy = target.querySelector('.candy');
        const rect = target.getBoundingClientRect();
        
        this.selectedCandy = { 
            row, 
            col, 
            element: target, 
            candy: candy,
            startRect: rect,
            moved: false
        };
        
        target.classList.add('selected');
        candy.classList.add('swiping');
        
        // Store initial touch/mouse position
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        this.dragStart = { x: clientX, y: clientY };
        this.swipeTarget = null;
    }

    handleMove(e) {
        if (!this.selectedCandy || this.isAnimating) return;
        
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - this.dragStart.x;
        const deltaY = clientY - this.dragStart.y;
        const threshold = 15;
        
        const candy = this.selectedCandy.candy;
        const cellSize = this.selectedCandy.startRect.width;
        
        // Determine primary direction and constrain movement
        let constrainedDeltaX = 0;
        let constrainedDeltaY = 0;
        let targetRow = this.selectedCandy.row;
        let targetCol = this.selectedCandy.col;
        
        if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
            this.selectedCandy.moved = true;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal movement
                const direction = deltaX > 0 ? 1 : -1;
                targetCol += direction;
                
                if (this.isValidPosition(targetRow, targetCol)) {
                    // Constrain movement to maximum of one cell width
                    constrainedDeltaX = Math.max(-cellSize, Math.min(cellSize, deltaX));
                    constrainedDeltaX = direction > 0 ? 
                        Math.min(constrainedDeltaX, cellSize) : 
                        Math.max(constrainedDeltaX, -cellSize);
                } else {
                    // Don't allow movement beyond board boundaries
                    constrainedDeltaX = 0;
                    targetCol = this.selectedCandy.col;
                }
            } else {
                // Vertical movement
                const direction = deltaY > 0 ? 1 : -1;
                targetRow += direction;
                
                if (this.isValidPosition(targetRow, targetCol)) {
                    // Constrain movement to maximum of one cell height
                    constrainedDeltaY = Math.max(-cellSize, Math.min(cellSize, deltaY));
                    constrainedDeltaY = direction > 0 ? 
                        Math.min(constrainedDeltaY, cellSize) : 
                        Math.max(constrainedDeltaY, -cellSize);
                } else {
                    // Don't allow movement beyond board boundaries
                    constrainedDeltaY = 0;
                    targetRow = this.selectedCandy.row;
                }
            }
        }
        
        // Apply constrained movement
        candy.style.transform = `translate(${constrainedDeltaX}px, ${constrainedDeltaY}px)`;
        
        // Clear previous target
        if (this.swipeTarget) {
            this.swipeTarget.classList.remove('swipe-target');
            this.swipeTarget = null;
        }
        
        // Highlight new target if valid and different from current
        if (this.isValidPosition(targetRow, targetCol) && 
            (targetRow !== this.selectedCandy.row || targetCol !== this.selectedCandy.col)) {
            const targetCell = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
            if (targetCell) {
                targetCell.classList.add('swipe-target');
                this.swipeTarget = targetCell;
            }
        }
    }

    handleEnd(e) {
        if (!this.selectedCandy) return;
        
        const candy = this.selectedCandy.candy;
        
        // Check if we have a valid swipe target
        if (this.swipeTarget && this.selectedCandy.moved) {
            const targetRow = parseInt(this.swipeTarget.dataset.row);
            const targetCol = parseInt(this.swipeTarget.dataset.col);
            
            if (this.isAdjacent(this.selectedCandy.row, this.selectedCandy.col, targetRow, targetCol)) {
                // Animate to target position before swap
                const targetRect = this.swipeTarget.getBoundingClientRect();
                const startRect = this.selectedCandy.startRect;
                const finalDeltaX = targetRect.left - startRect.left;
                const finalDeltaY = targetRect.top - startRect.top;
                
                candy.style.transform = `translate(${finalDeltaX}px, ${finalDeltaY}px)`;
                
                setTimeout(() => {
                    this.attemptSwap(
                        this.selectedCandy.row, this.selectedCandy.col,
                        targetRow, targetCol
                    );
                    this.clearSelection();
                }, 100);
                return;
            }
        } else if (!this.selectedCandy.moved) {
            // Handle click-based selection for non-drag interactions
            const target = e.target.closest('.cell');
            if (target && target !== this.selectedCandy.element) {
                const targetRow = parseInt(target.dataset.row);
                const targetCol = parseInt(target.dataset.col);
                
                if (this.isAdjacent(this.selectedCandy.row, this.selectedCandy.col, targetRow, targetCol)) {
                    this.attemptSwap(
                        this.selectedCandy.row, this.selectedCandy.col,
                        targetRow, targetCol
                    );
                }
            }
        }
        
        // Reset position if no valid move
        if (this.selectedCandy.moved) {
            candy.style.transform = '';
        }
        
        this.clearSelection();
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize;
    }

    isAdjacent(row1, col1, row2, col2) {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    clearSelection() {
        if (this.selectedCandy) {
            this.selectedCandy.element.classList.remove('selected');
            this.selectedCandy.candy.classList.remove('swiping');
            this.selectedCandy.candy.style.transform = '';
            this.selectedCandy = null;
        }
        
        if (this.swipeTarget) {
            this.swipeTarget.classList.remove('swipe-target');
            this.swipeTarget = null;
        }
        
        document.querySelectorAll('.cell.hint').forEach(cell => {
            cell.classList.remove('hint');
        });
    }

    async attemptSwap(row1, col1, row2, col2) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        // Perform the swap
        this.swapCandies(row1, col1, row2, col2);
        await this.animateSwap(row1, col1, row2, col2);
        
        // Check for matches
        const matches = this.findAllMatches();
        
        if (matches.length > 0) {
            // Valid move
            this.updateUI();
            await this.processMatches();
        } else {
            // Invalid move - swap back
            this.swapCandies(row1, col1, row2, col2);
            await this.animateSwap(row1, col1, row2, col2, true);
        }
        
        this.isAnimating = false;
        
        // Check for level completion first
        if (this.checkLevelComplete()) {
            return;
        }
    }

    swapCandies(row1, col1, row2, col2) {
        const temp = this.board[row1][col1];
        this.board[row1][col1] = this.board[row2][col2];
        this.board[row2][col2] = temp;
    }

    async animateSwap(row1, col1, row2, col2, isRevert = false) {
        const cell1 = document.querySelector(`[data-row="${row1}"][data-col="${col1}"]`);
        const cell2 = document.querySelector(`[data-row="${row2}"][data-col="${col2}"]`);
        
        const candy1 = cell1.querySelector('.candy');
        const candy2 = cell2.querySelector('.candy');
        
        // Calculate positions
        const rect1 = cell1.getBoundingClientRect();
        const rect2 = cell2.getBoundingClientRect();
        
        const deltaX = rect2.left - rect1.left;
        const deltaY = rect2.top - rect1.top;
        
        // Animate the swap
        candy1.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        candy2.style.transform = `translate(${-deltaX}px, ${-deltaY}px)`;
        candy1.style.zIndex = '100';
        candy2.style.zIndex = '100';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Update candy types and reset transforms
        candy1.className = `candy ${this.board[row1][col1]}`;
        candy2.className = `candy ${this.board[row2][col2]}`;
        candy1.dataset.type = this.board[row1][col1];
        candy2.dataset.type = this.board[row2][col2];
        
        candy1.style.transform = '';
        candy2.style.transform = '';
        candy1.style.zIndex = '';
        candy2.style.zIndex = '';
    }

    findAllMatches() {
        const matches = new Set();
        
        // Check horizontal matches
        for (let row = 0; row < this.boardSize; row++) {
            let count = 1;
            let currentType = this.board[row][0];
            
            for (let col = 1; col < this.boardSize; col++) {
                if (this.board[row][col] === currentType) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = col - count; i < col; i++) {
                            matches.add(`${row},${i}`);
                        }
                    }
                    count = 1;
                    currentType = this.board[row][col];
                }
            }
            
            if (count >= 3) {
                for (let i = this.boardSize - count; i < this.boardSize; i++) {
                    matches.add(`${row},${i}`);
                }
            }
        }
        
        // Check vertical matches
        for (let col = 0; col < this.boardSize; col++) {
            let count = 1;
            let currentType = this.board[0][col];
            
            for (let row = 1; row < this.boardSize; row++) {
                if (this.board[row][col] === currentType) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = row - count; i < row; i++) {
                            matches.add(`${i},${col}`);
                        }
                    }
                    count = 1;
                    currentType = this.board[row][col];
                }
            }
            
            if (count >= 3) {
                for (let i = this.boardSize - count; i < this.boardSize; i++) {
                    matches.add(`${i},${col}`);
                }
            }
        }
        
        return Array.from(matches).map(pos => {
            const [row, col] = pos.split(',').map(Number);
            return { row, col };
        });
    }

    async processMatches() {
        const matches = this.findAllMatches();
        
        // Start draining after first match in level
        if (matches.length > 0 && !this.isDraining) {
            this.startDraining();
        }
        
        while (matches.length > 0) {
            // Add score
            this.score += matches.length * 10;
            
            // Create combo text for large matches
            if (matches.length >= 5) {
                this.createComboText(matches.length);
            }
            
            // Animate matching candies
            await this.animateMatches(matches);
            
            // Remove matched candies
            matches.forEach(({ row, col }) => {
                this.board[row][col] = null;
                this.createParticles(row, col);
            });
            
            // Drop candies down
            await this.dropCandies();
            
            // Fill empty spaces
            await this.fillBoard();
            
            // Check for new matches
            const newMatches = this.findAllMatches();
            matches.length = 0;
            matches.push(...newMatches);
        }
        
        // Check if there are any possible moves left
        await this.checkForPossibleMoves();
        
        this.updateUI();
    }

    async animateMatches(matches) {
        matches.forEach(({ row, col }) => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            const candy = cell.querySelector('.candy');
            candy.classList.add('matching');
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    async dropCandies() {
        const animations = [];
        
        for (let col = 0; col < this.boardSize; col++) {
            let writeIndex = this.boardSize - 1;
            
            for (let row = this.boardSize - 1; row >= 0; row--) {
                if (this.board[row][col] !== null) {
                    if (row !== writeIndex) {
                        this.board[writeIndex][col] = this.board[row][col];
                        this.board[row][col] = null;
                        
                        // Animate the drop
                        const fromCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        const toCell = document.querySelector(`[data-row="${writeIndex}"][data-col="${col}"]`);
                        
                        if (fromCell && toCell) {
                            animations.push(this.animateDrop(fromCell, toCell, this.board[writeIndex][col]));
                        }
                    }
                    writeIndex--;
                }
            }
        }
        
        await Promise.all(animations);
    }

    async animateDrop(fromCell, toCell, candyType) {
        const fromCandy = fromCell.querySelector('.candy');
        const toCandy = toCell.querySelector('.candy');
        
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        
        const deltaY = toRect.top - fromRect.top;
        
        fromCandy.style.transform = `translateY(${deltaY}px)`;
        fromCandy.style.zIndex = '50';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Update the target cell
        toCandy.className = `candy ${candyType}`;
        toCandy.dataset.type = candyType;
        
        // Clear the source cell
        fromCandy.className = 'candy';
        fromCandy.style.transform = '';
        fromCandy.style.zIndex = '';
    }

    async fillBoard() {
        const animations = [];
        
        for (let col = 0; col < this.boardSize; col++) {
            for (let row = 0; row < this.boardSize; row++) {
                if (this.board[row][col] === null) {
                    let candyType;
                    do {
                        candyType = this.candyTypes[Math.floor(Math.random() * this.candyTypes.length)];
                    } while (this.wouldCreateMatch(row, col, candyType));
                    
                    this.board[row][col] = candyType;
                    
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    const candy = cell.querySelector('.candy');
                    
                    candy.className = `candy ${candyType} falling`;
                    candy.dataset.type = candyType;
                    
                    animations.push(new Promise(resolve => {
                        setTimeout(() => {
                            candy.classList.remove('falling');
                            resolve();
                        }, 250);
                    }));
                }
            }
        }
        
        await Promise.all(animations);
    }

    createParticles(row, col) {
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        const rect = cell.getBoundingClientRect();
        const containerRect = this.particlesContainer.getBoundingClientRect();
        
        const particles = ['✨', '💫', '⭐', '🌟'];
        
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.textContent = particles[Math.floor(Math.random() * particles.length)];
            
            particle.style.left = `${rect.left - containerRect.left + Math.random() * rect.width}px`;
            particle.style.top = `${rect.top - containerRect.top + Math.random() * rect.height}px`;
            particle.style.fontSize = `${Math.random() * 10 + 15}px`;
            
            this.particlesContainer.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1000);
        }
    }

    createComboText(matchCount) {
        const comboText = document.createElement('div');
        comboText.className = 'combo-text';
        
        if (matchCount >= 7) {
            comboText.textContent = 'AMAZING!';
        } else if (matchCount >= 5) {
            comboText.textContent = 'GREAT!';
        } else {
            comboText.textContent = 'GOOD!';
        }
        
        comboText.style.left = '50%';
        comboText.style.top = '50%';
        comboText.style.transform = 'translate(-50%, -50%)';
        
        this.particlesContainer.appendChild(comboText);
        
        setTimeout(() => {
            if (comboText.parentNode) {
                comboText.parentNode.removeChild(comboText);
            }
        }, 1500);
    }

    showHint() {
        // Clear existing hints
        document.querySelectorAll('.cell.hint').forEach(cell => {
            cell.classList.remove('hint');
        });
        
        // Find possible moves
        const possibleMoves = this.findPossibleMoves();
        
        if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            const cell1 = document.querySelector(`[data-row="${randomMove.from.row}"][data-col="${randomMove.from.col}"]`);
            const cell2 = document.querySelector(`[data-row="${randomMove.to.row}"][data-col="${randomMove.to.col}"]`);
            
            cell1.classList.add('hint');
            cell2.classList.add('hint');
            
            setTimeout(() => {
                cell1.classList.remove('hint');
                cell2.classList.remove('hint');
            }, 3000);
        }
    }

    findPossibleMoves() {
        const moves = [];
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                // Check right
                if (col < this.boardSize - 1) {
                    this.swapCandies(row, col, row, col + 1);
                    if (this.findAllMatches().length > 0) {
                        moves.push({
                            from: { row, col },
                            to: { row, col: col + 1 }
                        });
                    }
                    this.swapCandies(row, col, row, col + 1); // Swap back
                }
                
                // Check down
                if (row < this.boardSize - 1) {
                    this.swapCandies(row, col, row + 1, col);
                    if (this.findAllMatches().length > 0) {
                        moves.push({
                            from: { row, col },
                            to: { row: row + 1, col }
                        });
                    }
                    this.swapCandies(row, col, row + 1, col); // Swap back
                }
            }
        }
        
        return moves;
    }

updateUI() {
        this.scoreElement.textContent = this.score;
        this.targetScoreElement.textContent = this.targetScore;
        this.floorElement.textContent = this.floor;
        this.levelElement.textContent = this.level;
        
        // Update progress bar
        const progress = Math.min((this.score / this.targetScore) * 100, 100);
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${this.score} / ${this.targetScore}`;
    }

    async checkForPossibleMoves() {
        const possibleMoves = this.findPossibleMoves();
        if (possibleMoves.length === 0) {
            // No moves left - explode all candies
            await this.explodeAllCandies();
            // Refill the board
            this.initializeBoard();
            this.renderBoard();
            this.updateUI();
        }
    }

    async explodeAllCandies() {
        // Create an array of all board positions
        const allPositions = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                allPositions.push({ row, col });
            }
        }
        
        // Animate all candies as matching
        allPositions.forEach(({ row, col }) => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            const candy = cell.querySelector('.candy');
            candy.classList.add('matching');
            this.createParticles(row, col);
        });
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear the board
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                this.board[row][col] = null;
            }
        }
    }

startDraining() {
        if (this.isDraining) return;
        
        this.isDraining = true;
        this.levelStartTime = Date.now();
        this.lastDrainIncrease = 0;
        this.drainRate = 10; // Reset to initial rate
        
        // Calculate maximum drain rate based on level and floor
        this.maxDrainRate = 10 + 5 * ((this.floor - 1) * 3 + this.level - 1);
        
        this.drainInterval = setInterval(() => {
            if (this.score > 0) {
                // Increase drain rate every 5 seconds, up to maximum
                const elapsedSeconds = Math.floor((Date.now() - this.levelStartTime) / 1000);
                const increaseCount = Math.floor(elapsedSeconds / 5);
                
                if (increaseCount > this.lastDrainIncrease) {
                    this.drainRate = Math.min(this.drainRate + 5, this.maxDrainRate);
                    this.lastDrainIncrease = increaseCount;
                }
                
                this.score = Math.max(0, this.score - this.drainRate);
                this.updateUI();
                
                // Check if level is complete
                if (this.score >= this.targetScore) {
                    this.stopDraining();
                    this.checkLevelComplete();
                }
                
                // Check if game over
                if (this.score <= 0) {
                    this.stopDraining();
                    this.gameOver();
                }
            }
        }, 1000);
    }

    stopDraining() {
        if (this.drainInterval) {
            clearInterval(this.drainInterval);
            this.drainInterval = null;
        }
        this.isDraining = false;
    }

    levelComplete() {
        // Update modal with completion info
        document.getElementById('completedFloor').textContent = this.floor;
        document.getElementById('completedLevel').textContent = this.level;
        document.getElementById('levelScore').textContent = this.score;
        
        const bonusText = document.getElementById('bonusText');
        bonusText.textContent = '';
        
        this.levelCompleteModal.classList.add('show');
    }

nextLevel() {
        this.levelCompleteModal.classList.remove('show');
        this.stopDraining();
        
        // Advance to next level
        this.level++;
        
        // Check if we need to advance to next floor
        if (this.level > 3) {
            this.floor++;
            this.level = 1;
        }
        
        // Calculate new target score
        this.targetScore = this.calculateTargetScore();
        
        // Reset for new level - zero out the score
        this.score = 0;
        this.selectedCandy = null;
        this.isAnimating = false;
        this.isDraining = false;
        this.drainRate = 10; // Reset drain rate for new level
        this.maxDrainRate = 10 + 5 * ((this.floor - 1) * 3 + this.level - 1); // Reset max drain rate
        this.levelStartTime = null;
        this.lastDrainIncrease = 0;
        
        // Create new board
        this.initializeBoard();
        this.renderBoard();
        this.updateUI();
    }

    gameOver() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalFloor').textContent = this.floor;
        document.getElementById('finalLevel').textContent = this.level;
        this.gameOverModal.classList.add('show');
    }

    newGame() {
        this.stopDraining();
        
        this.score = 0;
        this.selectedCandy = null;
        this.isAnimating = false;
        this.floor = 1;
        this.level = 1;
        this.baseScore = 100;
        this.targetScore = 100;
        this.isDraining = false;
        this.drainRate = 10; // Reset drain rate for new game
        this.maxDrainRate = 10; // Reset max drain rate for new game
        
        this.gameOverModal.classList.remove('show');
        this.levelCompleteModal.classList.remove('show');
        
        this.initializeBoard();
        this.renderBoard();
        this.updateUI();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CandyRushGame();
});