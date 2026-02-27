const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function sendBatchWithNonceControl(signer, builders, label) {
  const sender = await signer.getAddress();
  let nonce = await signer.getTransactionCount('pending');
  const txs = [];

  for (let i = 0; i < builders.length; i += 1) {
    try {
      const tx = await builders[i]({ nonce });
      console.log(`[${label}] sent`, { i, nonce, hash: tx.hash, from: sender });
      txs.push(tx);
      nonce += 1;
    } catch (error) {
      console.error(`[${label}] send_error`, { i, nonce, from: sender, message: error.message });
      throw error;
    }
  }

  for (let i = 0; i < txs.length; i += 1) {
    try {
      const receipt = await txs[i].wait();
      console.log(`[${label}] confirmed`, { i, hash: txs[i].hash, block: receipt.blockNumber });
    } catch (error) {
      console.error(`[${label}] confirm_error`, { i, hash: txs[i].hash, message: error.message });
      throw error;
    }
  }
}

function getConfigPath() {
  const candidates = [
    path.join(process.cwd(), 'config', 'network-config.json'),
    path.join(process.cwd(), 'network-config.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('network-config.json not found. Run deployment/setup first.');
}

async function main() {
  const configPath = getConfigPath();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const [strategic, opA, opB, ...rest] = await hre.ethers.getSigners();
  const command = await hre.ethers.getContractAt('MDCNCommand', config.commandContractAddress, strategic);
  const coordination = await hre.ethers.getContractAt('MDCNCoordination', config.coordinationContractAddress, opA);
  const tactical = await hre.ethers.getContractAt('MDCNTactical', config.tacticalContractAddress, opB);

  const commandBuilders = [];
  for (const layer of [1, 2, 3]) {
    for (const group of [1, 2, 3, 4]) {
      for (const branch of [1, 2, 3]) {
        commandBuilders.push((overrides) =>
          command.sendCommand(layer, group, branch, `AUTO CMD | Layer ${layer} | Group ${group} | Branch ${branch}`, overrides)
        );
      }
    }
  }

  const intelBuilders = [];
  for (const recipient of config.adminAddresses.slice(0, 3)) {
    intelBuilders.push((overrides) =>
      coordination.syncIntelligence(recipient, `AUTO INTEL | direct to ${recipient.slice(0, 8)}`, overrides)
    );
  }
  for (const group of [1, 2, 3, 4]) {
    for (const branch of [1, 2, 3]) {
      intelBuilders.push((overrides) =>
        coordination.syncIntelligenceLegacy(group, branch, `AUTO INTEL LEGACY | Group ${group} | Branch ${branch}`, overrides)
      );
    }
  }

  const tacticalRecipients = rest.slice(0, 6).map((s) => s.address);
  const fieldBuilders = tacticalRecipients.map((recipient, i) =>
    (overrides) => tactical.logFieldData(recipient, `AUTO FIELD | recipient #${i} ${recipient.slice(0, 8)}`, overrides)
  );

  console.log('Starting hierarchy automation...');
  console.log('Counts', { commands: commandBuilders.length, intel: intelBuilders.length, field: fieldBuilders.length });

  await sendBatchWithNonceControl(strategic, commandBuilders, 'COMMAND');
  await sendBatchWithNonceControl(opA, intelBuilders, 'COORDINATION');
  await sendBatchWithNonceControl(opB, fieldBuilders, 'TACTICAL');

  console.log('Hierarchy automation complete.');
}

main().catch((error) => {
  console.error('Hierarchy automation failed:', error);
  process.exit(1);
});
