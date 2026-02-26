# Military Distributed Communication Network (MDCN)

This project is a local, role-based communication simulation built on Solidity smart contracts and a React frontend. It is designed to mimic layered military-style command flow (Strategic, Operational, Tactical) while keeping everything testable on a Hardhat local network.

If you want the short version: people with the right role send commands, other people acknowledge them, everyone pretends to be very serious, and the blockchain keeps receipts.

## What this project does

MDCN provides three communication layers backed by separate contracts:

- Strategic command flow for issuing and executing commands.
- Operational coordination flow for intelligence sharing.
- Tactical flow for field data and maintenance updates.

The frontend lets users log in as role-assigned accounts and perform common actions:

- Send command/intelligence/field updates.
- Acknowledge received messages.
- Respond to received items.
- Track message state and timestamps.

The role system is enforced on-chain through the command contract.

## Architecture overview

### Contracts

- `Contracts/MDCNCommand.sol`
  - Defines roles:
    - `0` None
    - `1` Strategic
    - `2` Operational
    - `3` Tactical
  - Supports:
    - Role assignment
    - Command creation
    - Command acknowledgement
    - Command execution

- `Contracts/MDCNCoordination.sol`
  - Stores and emits intelligence messages.
  - Supports both legacy group/branch messaging and direct recipient messaging.
  - Supports intelligence acknowledgement.

- `Contracts/MDCNTactical.sol`
  - Stores field data and maintenance records.
  - Supports legacy and direct recipient messaging.
  - Supports acknowledgement of field and maintenance records.

### Frontend

Main React app files live under `src/`.

- `src/App.js`
  - App routing
  - Wallet connection flow (MetaMask and SoftHat local wallet mode)
  - Contract initialization using selected signer
  - Role-based route and section rendering

- `src/components/`
  - `Navbar.js` for global navigation and wallet connect/logout actions
  - `CommandSection.js`, `CoordinationSection.js`, `TacticalSection.js` for composing and sending messages
  - `Inbox.js` for command inbox and acknowledgements
  - `SoftHatModal.js` for local key import / account switching helper

- `src/pages/`
  - `AdminLogin.js`, `AdminDashboard.js`
  - `SubordinateLogin.js`, `SubordinateDashboard.js`

### Local tooling

- Hardhat config and tasks in `hardhat.config.js`
- Deployment script in `scripts/deploy.js`
- Local convenience script in `scripts/hardhat-setup.js`

## Wallet modes

This app currently supports two ways to connect a signer:

### 1) MetaMask mode

Use your browser extension wallet connected to local Hardhat network.

### 2) SoftHat mode (local fake-wallet UX)

SoftHat is a local helper flow intended for localhost development:

- You can import a private key manually.
- You can quickly pick accounts from `public/softhat-accounts.json`.
- You can copy fake token labels and private keys from the popup.
- You can switch identities fast by logout then reconnect.

SoftHat is intentionally local-only behavior. If you point it at production and it lets you do that, treat that as user error mixed with optimism.

## Roles and expected behavior

- Strategic users (admin role) can send higher-level commands and execute commands.
- Operational and Tactical users can perform their respective communication functions.
- Message acknowledgements are recorded and surfaced in dashboards.

If an account has no role assigned, it will be blocked from functional dashboards.

## Prerequisites

- Node.js 16+ (18+ recommended)
- npm
- Optional: MetaMask extension if you want MetaMask mode

## Setup and run (manual flow)

1. Install dependencies:

```bash
npm install
```

2. Compile contracts:

```bash
npx hardhat compile
```

3. Start Hardhat node:

```bash
npx hardhat node
```

4. Deploy contracts to localhost:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

5. Start React app:

```bash
npm start
```

At this point you can connect either with MetaMask or SoftHat.

## Setup and run (scripted dev flow)

You can use the project helper script:

```bash
npm run dev
```

This script attempts to:

- Start/prepare local Hardhat node
- Generate local config data
- Deploy contracts
- Update frontend contract config references
- Start the React app

## Common project scripts

- `npm run start` - start React app
- `npm run build` - create production build
- `npm run test` - run tests
- `npm run dev` - run local all-in-one setup flow
- `npm run hardhat:node` - start hardhat node
- `npm run hardhat:deploy` - deploy contracts to localhost
- `npm run hardhat:update` - update app config from generated network config
- `npm run hardhat:accounts` - print configured accounts

## Local account and config files

Common generated/static config files used in local workflow:

- `config/network-config.json`
- `network-config.json`
- `config/metamask-import.txt`
- `public/softhat-accounts.json`

These may include private keys for local testing. Keep that local. Do not use those keys for anything real unless your retirement plan includes avoidable regret.

## Messaging behavior details

The app uses contract events and contract reads to populate dashboard state:

- Commands are loaded from `CommandSent` and checked against command state.
- Intelligence is loaded from `IntelligenceSynced` and acknowledgement state.
- Field data and maintenance are loaded from tactical events and storage lookups.

For some legacy paths, metadata (branch/group) is prefixed into message text and parsed in UI.

## Troubleshooting

### `react-scripts: not found`

Dependencies are not fully installed. Run `npm install` and retry.

### npm install fails with registry/network policy errors

Your environment may block certain package downloads. Use an allowed npm registry mirror or run in a network environment with package access.

### Wallet connects but app still shows unauthorized

The connected account likely has no assigned role in deployed contracts. Re-run deployment/role setup or connect with one of the configured role accounts.

### No data appears in dashboard

Check all of the following:

- Hardhat node is running on expected host/port.
- Contracts were deployed to that node.
- Frontend points to correct contract addresses.
- You are connected with an account that can read/send in current flow.

## Current status and intent

This is a local simulation/demo architecture intended for role-driven communication flows and contract interaction testing. It is not presented as a hardened production command system.

If you treat it like production anyway, at least log your risks somewhere official so future you can say "we discussed this".
