# MDCN Execution Guide

Follow these sequential steps to boot up the entire Military Distributed Communication Network (MDCN) locally.

> [!IMPORTANT]
> Ensure you run each of the continuous commands (like the node and the frontend) in separate terminal windows so they can run concurrently.

## Phase 1: Local Blockchain Infrastructure

Open a **new terminal window**, navigate to the project directory, and start the local Hardhat node. This simulates the Ethereum network:

```sh
npx kill-port 8545
npx hardhat node
```
*(Leave this terminal window running in the background).*

## Phase 2: Deploying the Security Model

Open a **second terminal window** in the project directory. Run the specific deployment script which will compile the contracts, deploy them to your local node, and assign the strict Role and Branch assignments to the first 10 accounts:

```sh
npx hardhat run scripts/deploy.js --network localhost
```

## Phase 3: Launching the Interface

In that same second terminal window (or a third one), boot up the React development server:

```sh
npm start
```
The application will automatically open in your default browser at `http://localhost:3000`.

---

## 💡 Testing Guide

To properly test the hierarchy and branch isolation:
1. Ensure your browser extension wallet (like MetaMask) is pointed to `Localhost 8545` (Chain ID 31337).
2. Import **Account #0** or **#1** (from the `npx hardhat node` terminal output) to test the **Strategic Command** (Admin).
3. Import **Account #3** or **#12** to test **Operational** or **Tactical** interactions on the Subordinate Dashboard.
4. Input the specific matching private key when prompted by the **SoftHat Hub** login section.
