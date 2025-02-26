const CONTRACT_ADDRESS = "0x608060405234801561001057600080fd5b506004..."; // Укажи здесь свой полный контракт
const CONTRACT_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "score", "type": "uint256" }],
        "name": "recordScore",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
        "name": "getLastScore",
        "outputs": [{ "internalType": "uint256", "name": "score", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

let provider;
let signer;
let contract;
let walletType = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectWallet").addEventListener("click", connectWallet);
});

async function connectWallet() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "MetaMask";
    } else if (window.solana && window.solana.isPhantom) {
        provider = window.solana;
        walletType = "Phantom";
    } else if (window.rabby) {
        provider = new ethers.providers.Web3Provider(window.rabby);
        walletType = "Rabby";
    } else {
        alert("No supported wallet found!");
        return;
    }

    try {
        if (walletType === "MetaMask" || walletType === "Rabby") {
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
        } else if (walletType === "Phantom") {
            await provider.connect();
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        document.getElementById("walletStatus").innerText = `Connected: ${walletType}`;
        updateBestScore();
    } catch (err) {
        console.error("Wallet connection failed", err);
    }
}

async function recordGameResult(finalScore) {
    if (!signer) {
        alert("Wallet not connected!");
        return;
    }
    try {
        const tx = await contract.recordScore(finalScore);
        console.log("Score recorded:", tx.hash);
        alert("Score recorded on blockchain!");
        await updateBestScore();
    } catch (error) {
        console.error("Error recording score:", error);
    }
}

async function updateBestScore() {
    if (!signer) return;
    try {
        const playerAddress = await signer.getAddress();
        const bestScore = await contract.getLastScore(playerAddress);
        document.getElementById("lastScore").innerText = `Best Score: ${bestScore}`;
    } catch (error) {
        console.error("Error fetching best score:", error);
        document.getElementById("lastScore").innerText = "Best Score: No record found";
    }
}

function endGame(finalScore) {
    console.log("Game Over! Score:", finalScore);
    document.getElementById("gameOver").innerText = "Game Over!";
    recordGameResult(finalScore);
}
