const HEX_RADIUS = 30;
const CELL_DIAMETER = 40;
const BOARD_RADIUS = 3;
const directions = [
  {q: 1,  r: 0},
  {q: 1,  r: -1},
  {q: 0,  r: -1},
  {q: -1, r: 0},
  {q: -1, r: 1},
  {q: 0,  r: 1}
];

let board = {};
let cells = [];
let queue = [];
let score = 0;
let moves = 0;       // количество совершённых ходов
let maxLevel = 1;    // максимальный достигнутый уровень
let gameOver = false;

const boardDiv = document.getElementById("board");
const queueDiv = document.getElementById("queue");
const scoreDiv = document.getElementById("score");
const gameOverDiv = document.getElementById("gameOver");

document.addEventListener("DOMContentLoaded", () => {
  initGame();
  document.getElementById("newGame").addEventListener("click", resetGame);
});

function initGame() {
  createBoard();
  initQueue();
  updateScore();
  renderQueue();
}

function createBoard() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    const r1 = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS);
    const r2 = Math.min(BOARD_RADIUS, -q + BOARD_RADIUS);
    for (let r = r1; r <= r2; r++) {
      const x = HEX_RADIUS * Math.sqrt(3) * (q + r/2);
      const y = HEX_RADIUS * 3/2 * r;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const cell = {
        q: q,
        r: r,
        x: x,
        y: y,
        token: null,
        element: null
      };
      cells.push(cell);
      board[coordKey(q, r)] = cell;
    }
  }

  const margin = 20;
  cells.forEach(cell => {
    const cellDiv = document.createElement("div");
    cellDiv.classList.add("cell");
    const left = cell.x - minX + margin - CELL_DIAMETER/2;
    const top  = cell.y - minY + margin - CELL_DIAMETER/2;
    cellDiv.style.left = left + "px";
    cellDiv.style.top = top + "px";
    cellDiv.addEventListener("click", () => {
      if (gameOver) return;
      if (cell.token !== null) return;
      placeToken(cell);
    });
    boardDiv.appendChild(cellDiv);
    cell.element = cellDiv;
  });
}

function coordKey(q, r) {
  return q + "," + r;
}

function initQueue() {
  queue = [];
  for (let i = 0; i < 3; i++) {
    queue.push(getRandomToken());
  }
}

function getRandomToken() {
  const color = Math.random() < 0.5 ? "red" : "blue";
  const r = Math.random();
  let level;
  if (r < 0.6) level = 1;
  else if (r < 0.85) level = 2;
  else if (r < 0.95) level = 3;
  else level = 4;
  return { color, level };
}

function renderQueue() {
  queueDiv.innerHTML = "";
  queue.forEach(token => {
    const tokenDiv = document.createElement("div");
    tokenDiv.classList.add("queue-token");
    tokenDiv.style.backgroundColor = token.color;
    tokenDiv.innerText = token.level;
    queueDiv.appendChild(tokenDiv);
  });
}

function updateScore() {
  scoreDiv.innerText = "Score: " + score;
}

function placeToken(cell) {
  if (queue.length === 0) return;
  const token = queue.shift();
  cell.token = token;
  updateCell(cell);
  moves++; // увеличиваем число ходов
  queue.push(getRandomToken());
  renderQueue();
  checkMerge(cell);
  checkGameOver();
}

function updateCell(cell) {
  cell.element.innerHTML = "";
  if (cell.token !== null) {
    const tokenDiv = document.createElement("div");
    tokenDiv.classList.add("token");
    tokenDiv.style.backgroundColor = cell.token.color;
    tokenDiv.innerText = cell.token.level;
    cell.element.appendChild(tokenDiv);
  }
}

function getNeighbors(cell) {
  const neighbors = [];
  directions.forEach(dir => {
    const nKey = coordKey(cell.q + dir.q, cell.r + dir.r);
    if (board[nKey]) {
      neighbors.push(board[nKey]);
    }
  });
  return neighbors;
}

function checkMerge(cell) {
  if (!cell.token) return;
  const { color, level } = cell.token;
  const group = getConnectedGroup(cell, color, level);
  if (group.length >= 3) {
    group.forEach(c => {
      if (c !== cell) {
        c.token = null;
        updateCell(c);
      }
    });
    cell.token.level = level + 1;
    if (cell.token.level > maxLevel) {
      maxLevel = cell.token.level;
    }
    updateCell(cell);
    score += cell.token.level * group.length * 10;
    updateScore();
    setTimeout(() => {
      checkMerge(cell);
    }, 200);
  }
}

function getConnectedGroup(startCell, color, level) {
  const group = [];
  const visited = new Set();
  const stack = [startCell];
  while (stack.length) {
    const cell = stack.pop();
    const key = coordKey(cell.q, cell.r);
    if (visited.has(key)) continue;
    visited.add(key);
    if (cell.token && cell.token.color === color && cell.token.level === level) {
      group.push(cell);
      const neighbors = getNeighbors(cell);
      neighbors.forEach(n => {
        if (!visited.has(coordKey(n.q, n.r))) {
          stack.push(n);
        }
      });
    }
  }
  return group;
}

function checkGameOver() {
  const empty = cells.some(cell => cell.token === null);
  if (!empty) {
    gameOver = true;
    document.getElementById("newGame").style.display = "block";
    // Добавляем класс для отображения надписи Game Over по центру
    boardDiv.classList.add("show-game-over");
    endGame(score, moves, maxLevel);
  }
}

function resetGame() {
  boardDiv.innerHTML = "";
  boardDiv.classList.remove("show-game-over");
  queueDiv.innerHTML = "";
  gameOver = false;
  cells = [];
  board = {};
  queue = [];
  score = 0;
  moves = 0;
  maxLevel = 1;
  document.getElementById("newGame").style.display = "none";
  initGame();
}
