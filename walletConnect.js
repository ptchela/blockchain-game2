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
const MONAD_CHAIN_ID = "0x279f"; // Hex representation of 10143
const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectWallet").addEventListener("click", connectWallet);
});

async function connectWallet() {
    let providerInfo = null;

    // Check if Phantom (with EVM support) is available
    if (window.ethereum && window.ethereum.isPhantom) {
        providerInfo = {
            provider: new ethers.providers.Web3Provider(window.ethereum),
            walletType: "Phantom"
        };
    } else if (window.ethereum) {
        // Fallback for MetaMask or other Ethereum providers
        providerInfo = {
            provider: new ethers.providers.Web3Provider(window.ethereum),
            walletType: "MetaMask"
        };
    } else if (window.solana && window.solana.isPhantom) {
        // This branch is for Phantom without EVM support (likely not usable for our game)
        providerInfo = {
            provider: new ethers.providers.Web3Provider(window.solana),
            walletType: "Phantom (Solana)"
        };
    } else if (window.rabby) {
        providerInfo = {
            provider: new ethers.providers.Web3Provider(window.rabby),
            walletType: "Rabby"
        };
    } else {
        alert("No supported wallet found!");
        return;
    }

    // Use the selected provider
    const { provider: selectedProvider, walletType: selectedWalletType } = providerInfo;
    provider = selectedProvider;
    walletType = selectedWalletType;

    try {
        // Request account access
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Check the current chain ID
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== MONAD_CHAIN_ID) {
            alert("You are on the wrong network. Attempting to switch to Monad Testnet...");
            try {
                // Request to switch the network to Monad Testnet
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: MONAD_CHAIN_ID }],
                });
            } catch (switchError) {
                // If the network is not added, attempt to add it
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: MONAD_CHAIN_ID,
                                chainName: "Monad Testnet",
                                nativeCurrency: {
                                    name: "MON",
                                    symbol: "MON",
                                    decimals: 18,
                                },
                                rpcUrls: [MONAD_RPC_URL],
                                blockExplorerUrls: [], // Optionally add an explorer URL if available
                            }],
                        });
                    } catch (addError) {
                        console.error("Failed to add Monad Testnet", addError);
                        alert("Failed to add Monad Testnet. Please add it manually.");
                        return;
                    }
                } else {
                    console.error("Failed to switch network", switchError);
                    alert("Network switch failed. Please switch to Monad Testnet manually.");
                    return;
                }
            }
        }

        document.getElementById("walletStatus").innerText = `Connected: ${walletType}`;
        updateBestScore();
    } catch (err) {
        console.error("Wallet connection failed", err);
    }
}

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
        const tx = await contract.recordScore(points, moves, level, { gasLimit: gasLimit });
        console.log("Transaction sent:", tx.hash);
        alert("Transaction sent. Please confirm in your wallet.");
        await tx.wait();
        console.log("Transaction confirmed:", tx.hash);
        alert("Score recorded on blockchain!");
        await updateBestScore();
    } catch (error) {
        console.error("Error recording score:", error);
        alert("Error recording score: " + error.message);
    }
}

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

function endGame(points, moves, level) {
    console.log("Game Over! Score:", points, "Moves:", moves, "Level:", level);
    document.getElementById("gameOver").innerText = "Game Over!";
    recordGameResult(points, moves, level);
}

window.endGame = endGame;
