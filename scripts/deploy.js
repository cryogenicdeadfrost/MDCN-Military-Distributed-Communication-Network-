const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get the accounts from Hardhat
  const accounts = await hre.ethers.getSigners();
  console.log(`Using account: ${accounts[0].address}`);

  // Deploy the MDCNCommand contract
  console.log("Deploying MDCNCommand contract...");
  const MDCNCommand = await hre.ethers.getContractFactory("MDCNCommand");
  const commandContract = await MDCNCommand.deploy();
  await commandContract.deployed();
  console.log(`MDCNCommand deployed to: ${commandContract.address}`);

  // Deploy the MDCNCoordination contract
  console.log("Deploying MDCNCoordination contract...");
  const MDCNCoordination = await hre.ethers.getContractFactory("MDCNCoordination");
  const coordinationContract = await MDCNCoordination.deploy(commandContract.address);
  await coordinationContract.deployed();
  console.log(`MDCNCoordination deployed to: ${coordinationContract.address}`);

  // Deploy the MDCNTactical contract
  console.log("Deploying MDCNTactical contract...");
  const MDCNTactical = await hre.ethers.getContractFactory("MDCNTactical");
  const tacticalContract = await MDCNTactical.deploy(commandContract.address);
  await tacticalContract.deployed();
  console.log(`MDCNTactical deployed to: ${tacticalContract.address}`);

  // Update the config file with the actual contract addresses
  const configPath = path.join(__dirname, "..", "config", "network-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.commandContractAddress = commandContract.address;
    config.coordinationContractAddress = coordinationContract.address;
    config.tacticalContractAddress = tacticalContract.address;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Config file updated with contract addresses");
  }

  // Assign roles to all accounts
  console.log("Assigning roles to accounts...");

  // Role definitions
  const ROLES = { NONE: 0, STRATEGIC: 1, OPERATIONAL: 2, TACTICAL: 3 };
  // Branch definitions 
  const BRANCHES = { NONE: 0, ARMY: 1, NAVY: 2, AIRFORCE: 3 };

  // Mapping the specific 10 accounts we use in our UI/Test
  const roleBranchAssignments = [
    { index: 1, role: ROLES.STRATEGIC, branch: BRANCHES.NAVY },
    { index: 2, role: ROLES.STRATEGIC, branch: BRANCHES.AIRFORCE },
    { index: 3, role: ROLES.OPERATIONAL, branch: BRANCHES.ARMY },
    { index: 4, role: ROLES.OPERATIONAL, branch: BRANCHES.NAVY },
    { index: 5, role: ROLES.OPERATIONAL, branch: BRANCHES.AIRFORCE },
    { index: 11, role: ROLES.TACTICAL, branch: BRANCHES.AIRFORCE },
    { index: 12, role: ROLES.TACTICAL, branch: BRANCHES.ARMY },
    { index: 13, role: ROLES.TACTICAL, branch: BRANCHES.NAVY },
    { index: 18, role: ROLES.TACTICAL, branch: BRANCHES.ARMY }
  ];

  for (const mapping of roleBranchAssignments) {
    if (accounts[mapping.index]) {
      const tx = await commandContract.setRoleAndBranch(
        accounts[mapping.index].address,
        mapping.role,
        mapping.branch
      );
      await tx.wait();
      console.log(`Assigned Role ${mapping.role} & Branch ${mapping.branch} to account ${mapping.index}: ${accounts[mapping.index].address}`);
    }
  }

  console.log("Role and Branch assignment complete");

  console.log("Deployment and setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });