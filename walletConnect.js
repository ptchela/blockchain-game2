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
 * Инициализируем provider, signer и контракт на основе обнаруженного кошелька.
 */
function initProvider() {
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
    console.error("No recognized provider found.");
    return false;
  }
  signer = provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return true;
}

/**
 * Подписываемся на изменения аккаунтов и цепочки.
 */
function subscribeProviderEvents() {
  if (provider && provider.provider && provider.provider.on) {
    provider.provider.on("accountsChanged", (accounts) => {
      console.log("accountsChanged event:", accounts);
      if (accounts && accounts.length > 0) {
        document.getElementById("walletStatus").innerText = `Connected: ${walletType} (${accounts[0]})`;
        updateBestScore();
      } else {
        document.getElementById("walletStatus").innerText = "Not connected";
      }
    });

    provider.provider.on("chainChanged", (newChainId) => {
      console.log("chainChanged event detected:", newChainId);
      if (newChainId.toLowerCase() !== MONAD_CHAIN_ID) {
        alert("Please switch to Monad Testnet (chain ID 0x279f) for full functionality.");
      }
    });
  }
}

/**
 * Основная функция для подключения кошелька.
 * Теперь мы используем результат eth_requestAccounts для обновления UI сразу после первого клика.
 */
async function connectWallet() {
  if (!initProvider()) {
    alert("No supported wallet found! Please install Phantom or MetaMask.");
    return;
  }

  subscribeProviderEvents();

  try {
    // Запрашиваем доступ к аккаунтам и ждём результат
    const accounts = await provider.send("eth_requestAccounts", []);
    if (accounts && accounts.length > 0) {
      document.getElementById("walletStatus").innerText = `Connected: ${walletType} (${accounts[0]})`;
    } else {
      document.getElementById("walletStatus").innerText = "Not connected";
      return;
    }

    // Проверяем цепочку
    const currentChainId = await provider.send("eth_chainId", []);
    console.log("Current chain ID:", currentChainId);

    if (currentChainId !== MONAD_CHAIN_ID) {
      alert("You are on the wrong network. Attempting to switch to Monad Testnet...");
      try {
        await provider.send("wallet_switchEthereumChain", [{ chainId: MONAD_CHAIN_ID }]);
        console.log("Switched to Monad Testnet successfully!");
        // После переключения снова запрашиваем аккаунты
        const switchedAccounts = await provider.send("eth_requestAccounts", []);
        if (switchedAccounts && switchedAccounts.length > 0) {
          document.getElementById("walletStatus").innerText = `Connected: ${walletType} (${switchedAccounts[0]})`;
        }
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
            // После добавления цепочки – запрашиваем аккаунты
            const newAccounts = await provider.send("eth_requestAccounts", []);
            if (newAccounts && newAccounts.length > 0) {
              document.getElementById("walletStatus").innerText = `Connected: ${walletType} (${newAccounts[0]})`;
            }
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

    // После успешного подключения – обновляем данные из контракта
    updateBestScore();
  } catch (err) {
    console.error("Wallet connection failed:", err);
  }
}

/**
 * Обновление лучшего результата из контракта.
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
 * Запись результата игры в контракте.
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
 * Вызывается в конце игры.
 */
function endGame(points, moves, level) {
  console.log("Game Over! Score:", points, "Moves:", moves, "Level:", level);
  document.getElementById("gameOver").innerText = "Game Over!";
  recordGameResult(points, moves, level);
}

window.endGame = endGame;
