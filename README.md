# 🛰️ Military Distributed Communication Network (MDCN)

A blockchain-powered, permissioned communication system simulating secure inter-branch military coordination. Built using **Solidity**, **JavaScript**, and **Hardhat**, MDCN mirrors real-world strategic-to-tactical military operations through a layered architecture.

---

## 📌 Core Layers

| Layer         | Role                                  | Consensus     |
|---------------|----------------------------------------|----------------|
| Strategic     | Command issuance, policy control       | PoA            |
| Operational   | Inter-branch sync & coordination       | dBFT           |
| Tactical      | Field-level logging & execution        | FBA            |

Smart contracts automate commands, secure data, and enforce mission flows across all layers.

---

## ⚙️ Tech Stack

- **Smart Contracts**: `MDCNCommand.sol`, `MDCNCoordination.sol`, `MDCNTactical.sol`
- **Front-End**: `CommandSection.js`, `CoordinationSection.js`, `TacticalSection.js`
- **Blockchain Dev**: Hardhat (local node, compile, deploy)
- **Wallet**: MetaMask (for secure identity & interaction)

---

## 🚀 Quick Start

```bash
git clone https://github.com/yourusername/mdcn-blockchain.git
cd mdcn-blockchain
npm install
npx hardhat compile
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
npm start


## 🧪 CraftHat (Fake MetaMask for Localnet)

- Use **Connect Wallet** and choose CraftHat to run fully on localhost without MetaMask overhead.
- Copy Hardhat private keys/tokens from the in-app CraftHat popup and switch identities quickly (logout -> reconnect).
- Works with the same deployed contracts and role logic used by Hardhat localnet (chainId 31337/1337).
