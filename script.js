import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 사용자님의 스크린샷 값을 한 글자씩 대조하여 재작성했습니다. 
const firebaseConfig = {
    apiKey: "AIzaSyCBrvOhfy_GN2IVvkxI8X8cmr2o-rgNm-Q",
    authDomain: "gimpotest-f55d8.firebaseapp.com",
    projectId: "gimpotest-f55d8",
    storageBucket: "gimpotest-f55d8.firebasestorage.app",
    messagingSenderId: "1096819588772",
    appId: "1:1096819588772:web:3708dfb56823046e127031",
    measurementId: "G-PKMTY3Q0DC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let highestScore = 0;
const loginScreen = document.getElementById('login-screen');
const gameUI = document.getElementById('game-ui');

// 로그인 버튼
document.getElementById('btn-login').onclick = () => {
    signInWithPopup(auth, provider).catch(err => {
        alert("로그인 실패: " + err.message);
    });
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        gameUI.style.display = 'block';
        document.getElementById('user-display').innerText = user.displayName;
        subscribeHighScore(user.uid);
        subscribeRanking();
        playerReset();
        if (!gameRunning) update();
    } else {
        currentUser = null;
        loginScreen.style.display = 'block';
        gameUI.style.display = 'none';
    }
});

function subscribeHighScore(uid) {
    onSnapshot(doc(db, "scores", uid), (doc) => {
        if (doc.exists()) {
            highestScore = doc.data().score;
            document.getElementById('high-score').innerText = highestScore;
        }
    });
}

function subscribeRanking() {
    const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(5));
    onSnapshot(q, (snapshot) => {
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `<span>${data.name || '무명'}</span> <b>${data.score}</b>`;
            rankingList.appendChild(li);
        });
    });
}

async function saveHighScore(score) {
    if (!currentUser || score <= highestScore) return;
    await setDoc(doc(db, "scores", currentUser.uid), {
        score: score,
        name: currentUser.displayName,
        updatedAt: new Date()
    });
}

// --- 테트리스 로직 ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20);
let gameRunning = false;
const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
function createPiece(type) {
    if (type === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    if (type === 'L') return [[0,2,0],[0,2,0],[0,2,2]];
    if (type === 'J') return [[0,3,0],[0,3,0],[3,3,0]];
    if (type === 'O') return [[4,4],[4,4]];
    if (type === 'Z') return [[5,5,0],[0,5,5],[0,0,0]];
    if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === 'T') return [[0,7,0],[7,7,7],[0,0,0]];
}
function drawMatrix(matrix, offset, ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}
function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}
function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}
function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}
function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}
function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        saveHighScore(player.score); 
        player.score = 0;
        updateScore();
    }
    drawNext();
}
function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}
function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        rowCount *= 2;
    }
    if (player.score > highestScore) saveHighScore(player.score);
}
function updateScore() {
    document.getElementById('score').innerText = player.score;
}
function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    drawMatrix(player.next, {x: 1, y: 1}, nextContext);
}
function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);
}
const arena = createMatrix(12, 20);
const player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0 };
document.addEventListener('keydown', event => {
    if (!currentUser) return;
    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
});
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
function update(time = 0) {
    if (!currentUser) { gameRunning = false; return; }
    gameRunning = true;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
}