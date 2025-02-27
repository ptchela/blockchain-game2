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
const MONAD_CHAIN_ID = "0x279f"; // Hex для 10143
const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectWallet").addEventListener("click", connectWallet);
});

/**
 * Переинициализирует provider, signer и контракт в случае смены сети или по необходимости.
 */
function reInitProvider() {
    console.log("Re-initializing provider due to chain change or manual call...");

    // 1. Проверяем наличие Rabby
    if (window.rabby) {
        provider = new ethers.providers.Web3Provider(window.rabby);
        walletType = "Rabby";
        console.log("Using Rabby wallet");
    }
    // 2. Проверяем наличие Phantom через window.phantom.ethereum
    else if (window?.phantom?.ethereum && window.phantom.ethereum.isPhantom) {
        provider = new ethers.providers.Web3Provider(window.phantom.ethereum);
        walletType = "Phantom";
        console.log("Using Phantom EVM provider from window.phantom.ethereum");
    }
    // 3. Проверяем, если есть Ethereum провайдер с isPhantom
    else if (window.ethereum && window.ethereum.isPhantom) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "Phantom";
        console.log("Using Phantom EVM provider from window.ethereum");
    }
    // 4. Fallback: generic Ethereum provider (MetaMask, etc.)
    else if (window.ethereum) {
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
 * Основная функция для подключения кошелька и обеспечения работы в сети Monad Testnet.
 */
async function connectWallet() {
    // Определяем кошелек по порядку
    if (window.rabby) {
        console.log("Detected Rabby wallet");
        provider = new ethers.providers.Web3Provider(window.rabby);
        walletType = "Rabby";
    }
    else if (window?.phantom?.ethereum && window.phantom.ethereum.isPhantom) {
        console.log("Detected Phantom via window.phantom.ethereum");
        provider = new ethers.providers.Web3Provider(window.phantom.ethereum);
        walletType = "Phantom";
    }
    else if (window.ethereum && window.ethereum.isPhantom) {
        console.log("Detected Phantom via window.ethereum");
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "Phantom";
    }
    else if (window.ethereum) {
        console.log("Detected generic Ethereum provider (MetaMask, etc.)");
        provider = new ethers.providers.Web3Provider(window.ethereum);
        walletType = "MetaMask";
    }
    else {
        alert("No supported wallet found! Please install Phantom or another EVM wallet.");
        window.open("https://phantom.app/", "_blank");
        return;
    }

    // Подписываем событие смены сети
    if (provider.provider && provider.provider.on) {
        provider.provider.on("chainChanged", (newChainId) => {
            console.log("chainChanged event detected:", newChainId);
            reInitProvider();
            if (newChainId.toLowerCase() !== MONAD_CHAIN_ID) {
                alert("Please switch to Monad Testnet (chain ID 0x279f) for full functionality.");
            }
        });
    }

    try {
        // Если MetaMask, проверяем, на нужной ли сети
        if (walletType === "MetaMask") {
            const currentChainId = await provider.send("eth_chainId", []);
            console.log("Current chain ID:", currentChainId);
            if (currentChainId !== MONAD_CHAIN_ID) {
                alert("You are on the wrong network. Attempting to switch to Monad Testnet...");
                try {
                    await provider.send("wallet_switchEthereumChain", [{ chainId: MONAD_CHAIN_ID }]);
                    console.log("Switched to Monad Testnet successfully!");
                    reInitProvider();
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
        }

        // Проверяем, есть ли уже подключенные аккаунты
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length === 0) {
            await provider.send("eth_requestAccounts", []);
        } else {
            console.log("Accounts already connected:", accounts);
        }

        // Переинициализируем signer и контракт после подключения аккаунтов
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        document.getElementById("walletStatus").innerText = `Connected: ${walletType}`;
        // Небольшая задержка, чтобы дать время обновиться signer/контракту перед запросом best score
        setTimeout(updateBestScore, 100);
    } catch (err) {
        console.error("Wallet connection failed:", err);
    }
}

/**
 * Отправляет результат игры в блокчейн
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
 * Обновляет лучший результат, полученный из контракта
 */
async function updateBestScore() {
    if (!signer) return;
    try {
        const playerAddress = await signer.getAddress();
        const result = await contract.getBestScore(playerAddress);
        const points = result[0].toString();
        const moves = result[1].toString();
        const level = result[2].toString();
        document.getElementById("lastScore").innerText = `Best Score: ${points} (Moves: ${moves}, Level: ${level})`;
    } catch (error) {
        console.error("Error fetching best score:", error);
        document.getElementById("lastScore").innerText = "Best Score: No record found";
    }
}

/**
 * Вызывается по окончании игры
 */
function endGame(points, moves, level) {
    console.log("Game Over! Score:", points, "Moves:", moves, "Level:", level);
    document.getElementById("gameOver").innerText = "Game Over!";
    recordGameResult(points, moves, level);
}

// Делаем endGame доступной глобально
window.endGame = endGame;
