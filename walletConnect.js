const CONTRACT_ADDRESS = "0xe84f6DfbF2Bc1c78c831C45e761214aDD7f667ef";
const CONTRACT_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "points", "type": "uint256" },
            { "internalType": "uint256", "name": "moves", "type": "uint256" },
            { "internalType": "uint256", "name": "level", "type": "uint256" }
        ],
        "name": "recordScore",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
        "name": "getBestScore",
        "outputs": [
            { "internalType": "uint256", "name": "points", "type": "uint256" },
            { "internalType": "uint256", "name": "moves", "type": "uint256" },
            { "internalType": "uint256", "name": "level", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

let provider;
let signer;
let contract;
let walletType = null;

// Monad Testnet details
const MONAD_CHAIN_ID = "0x279f"; // Hex for 10143
const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectWallet").addEventListener("click", connectWallet);
});

/**
 * Re-initialize provider, signer, and contract based on whichever wallet is present.
 */
function reInitProvider() {
    console.log("Re-initializing provider...");
    if (window.rabby) {
        provider = new ethers.providers.Web3Provider(window.rabby);
        walletType = "Rabby";
        console.log("Using Rabby wallet");
    } else if (window?.phantom?.ethereum && window.phantom.ethereum.isPhantom) {
        provider = new ethers.providers.Web3Provider(window.phantom.ethereum);
        walletType = "Phantom";
        console.log("Using Phantom (window.phantom.ethereum)");
    } else if (window.ethereum && window.ethereum.isPhantom) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "Phantom";
        console.log("Using Phantom (window.ethereum)");
    } else if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "MetaMask";
        console.log("Using generic Ethereum provider (MetaMask or similar)");
    } else {
        console.error("No recognized provider found during re-initialization.");
        return;
    }
    signer = provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

/**
 * Main function to connect the wallet and ensure we are on Monad Testnet.
 */
async function connectWallet() {
    if (window.rabby) {
        console.log("Detected Rabby wallet");
        provider = new ethers.providers.Web3Provider(window.rabby);
        walletType = "Rabby";
    } else if (window?.phantom?.ethereum && window.phantom.ethereum.isPhantom) {
        console.log("Detected Phantom via window.phantom.ethereum");
        provider = new ethers.providers.Web3Provider(window.phantom.ethereum);
        walletType = "Phantom";
    } else if (window.ethereum && window.ethereum.isPhantom) {
        console.log("Detected Phantom via window.ethereum");
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "Phantom";
    } else if (window.ethereum) {
        console.log("Detected generic Ethereum provider (MetaMask, etc.)");
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "MetaMask";
    } else {
        alert("No supported wallet found! Please install Phantom or another EVM wallet.");
        window.open("https://phantom.app/", "_blank");
        return;
    }

    // Подписываемся на события
    if (provider.provider && provider.provider.on) {
        provider.provider.on("chainChanged", (newChainId) => {
            console.log("chainChanged event detected:", newChainId);
            reInitProvider();
            if (newChainId.toLowerCase() !== MONAD_CHAIN_ID) {
                alert("Please switch to Monad Testnet (chain ID 0x279f) for full functionality.");
            }
        });

        provider.provider.on("accountsChanged", (accounts) => {
            console.log("accountsChanged event detected:", accounts);
            updateUI(accounts);
        });

        // Некоторые кошельки (например, MetaMask) эмитят событие "connect"
        provider.provider.on("connect", (connectInfo) => {
            console.log("connect event detected:", connectInfo);
            updateUI();
        });
    }

    try {
        // Запрашиваем доступ к аккаунтам
        await provider.send("eth_requestAccounts", []);
        // Получаем аккаунты сразу после запроса
        const accounts = await provider.listAccounts();
        if (accounts.length === 0) {
            console.warn("No accounts returned after connection.");
        }
        reInitProvider();
        updateUI(accounts);

        // Проверяем цепочку
        const currentChainId = await provider.send("eth_chainId", []);
        console.log("Current chain ID:", currentChainId);

        if (currentChainId !== MONAD_CHAIN_ID) {
            alert("You are on the wrong network. Attempting to switch to Monad Testnet...");
            try {
                await provider.send("wallet_switchEthereumChain", [{ chainId: MONAD_CHAIN_ID }]);
                console.log("Switched to Monad Testnet successfully!");
                reInitProvider();
                await provider.send("eth_requestAccounts", []);
                updateUI();
            } catch (switchError) {
                if (switchError.code === 4902) {
                    try {
                        await provider.send("wallet_addEthereumChain", [{
                            chainId: MONAD_CHAIN_ID,
                            chainName: "Monad Testnet",
                            nativeCurrency: {
                                name: "MON",
                                symbol: "MON",
                                decimals: 18
                            },
                            rpcUrls: [MONAD_RPC_URL],
                            blockExplorerUrls: []
                        }]);
                        reInitProvider();
                        await provider.send("eth_requestAccounts", []);
                        updateUI();
                    } catch (addError) {
                        console.error("Failed to add Monad Testnet:", addError);
                        alert("Failed to add Monad Testnet. Please add it manually.");
                        return;
                    }
                } else {
                    console.error("Failed to switch network:", switchError);
                    alert("Network switch failed. Please switch to Monad Testnet manually.");
                    return;
                }
            }
        }
    } catch (err) {
        console.error("Wallet connection failed:", err);
    }
}

/**
 * Обновление UI, получение адреса и вызов updateBestScore.
 */
async function updateUI(accounts) {
    try {
        // Если accounts не переданы, получаем их
        if (!accounts) {
            accounts = await provider.listAccounts();
        }
        if (accounts.length > 0) {
            signer = provider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            document.getElementById("walletStatus").innerText = `Connected: ${walletType} (${accounts[0]})`;
            updateBestScore();
        } else {
            document.getElementById("walletStatus").innerText = `Not connected`;
        }
    } catch (err) {
        console.error("Error updating UI:", err);
    }
}

/**
 * Record the game result on-chain
 */
async function recordGameResult(points, moves, level) {
    if (!signer) {
        alert("Wallet not connected!");
        return;
    }
    try {
        console.log("Sending transaction with points:", points, "moves:", moves, "level:", level);
        let gasLimit;
        try {
            gasLimit = await contract.estimateGas.recordScore(points, moves, level);
            console.log("Gas estimate:", gasLimit.toString());
        } catch (e) {
            console.warn("Gas estimation failed, using default gas limit.", e);
            gasLimit = 300000;
        }
        const tx = await contract.recordScore(points, moves, level, { gasLimit });
        console.log("Transaction sent:", tx.hash);
        alert("Transaction sent. Please confirm in your wallet.");
        await tx.wait();
        console.log("Transaction confirmed:", tx.hash);
        alert("Score recorded on blockchain!");
        updateBestScore();
    } catch (error) {
        console.error("Error recording score:", error);
        alert("Error recording score: " + error.message);
    }
}

/**
 * Update the best score from the contract
 */
async function updateBestScore() {
    if (!signer) return;
    try {
        const playerAddress = await signer.getAddress();
        const result = await contract.getBestScore(playerAddress);
        const points = result[0].toString();
        const moves = result[1].toString();
        const level = result[2].toString();
        document.getElementById("lastScore").innerText =
            `Best Score: ${points} (Moves: ${moves}, Level: ${level})`;
    } catch (error) {
        console.error("Error fetching best score:", error);
        document.getElementById("lastScore").innerText = "Best Score: No record found";
    }
}

/**
 * Called at the end of the game
 */
function endGame(points, moves, level) {
    console.log("Game Over! Score:", points, "Moves:", moves, "Level:", level);
    document.getElementById("gameOver").innerText = "Game Over!";
    recordGameResult(points, moves, level);
}

window.endGame = endGame;
