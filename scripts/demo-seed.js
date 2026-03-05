const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

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

    const accounts = await hre.ethers.getSigners();
    // Role Mapping Setup from UI definitions
    const ROLES = { NONE: 0, STRATEGIC: 1, OPERATIONAL: 2, TACTICAL: 3 };
    const BRANCHES = { NONE: 0, ARMY: 1, NAVY: 2, AIRFORCE: 3 };

    const getAccount = (index) => accounts[index];

    // Specific assignment
    const adminArmy = getAccount(0); // Deployer
    const adminNavy = getAccount(1);
    const adminAirForce = getAccount(2);

    const opsArmy = getAccount(3);
    const opsNavy = getAccount(4);
    const opsAirForce = getAccount(5);

    const tacAirForce = getAccount(11);
    const tacArmy = getAccount(12);
    const tacNavy = getAccount(13);

    const command = await hre.ethers.getContractAt('MDCNCommand', config.commandContractAddress, adminArmy);
    const coordination = await hre.ethers.getContractAt('MDCNCoordination', config.coordinationContractAddress, opsArmy);
    const tactical = await hre.ethers.getContractAt('MDCNTactical', config.tacticalContractAddress, tacArmy);

    console.log("Seeding Demo Data...");

    // 1. STRATEGIC COMMANDS (Admin -> Ops/Tactical)
    // Army Admin sending to Army Ops
    await command.connect(adminArmy).sendCommand(1, 2, BRANCHES.ARMY, "Operation Desert Shield pre-checks authorized.");
    // Navy Admin sending to Navy Tactical
    await command.connect(adminNavy).sendCommand(1, 4, BRANCHES.NAVY, "Fleet positioning coordinates updated securely.");
    // AirForce Admin sending broadcast-like to AirForce Ops
    await command.connect(adminAirForce).sendCommand(1, 3, BRANCHES.AIRFORCE, "Flight paths verified over Sector 7G.");

    // 2. INTELLIGENCE SYNC (Coordination)
    // Ops Army -> Admin Army (Upwards)
    await coordination.connect(opsArmy).syncIntelligence(adminArmy.address, "Intel: Ground forces have secured the perimeter.");
    // Ops Navy -> Ops AirForce (Lateral)
    await coordination.connect(opsNavy).syncIntelligence(opsAirForce.address, "Intel: Carrier strike group moving to support radar coverage.");
    // Ops AirForce -> Admin AirForce (Upwards)
    await coordination.connect(opsAirForce).syncIntelligence(adminAirForce.address, "Intel: Recon drones returning with optimal footage.");

    // 3. FIELD DATA LOGGING (Tactical)
    // Tactical Army -> Ops Army (Write Up)
    await tactical.connect(tacArmy).logFieldData(opsArmy.address, "Field Data: Checkpoint bravo established, minor casualties.");
    // Tactical Navy -> Ops Navy (Write Up)
    await tactical.connect(tacNavy).logFieldData(opsNavy.address, "Field Data: Weather conditions optimal for maritime assault.");
    // Tactical AirForce -> Ops AirForce (Write Up)
    await tactical.connect(tacAirForce).logFieldData(opsAirForce.address, "Field Data: Runway 2 cleared for heavy bombers.");

    // 4. RESPONSES (Simulating UI replies)
    // Ops Army responding to Tactical Army's Field Data
    await coordination.connect(opsArmy).syncIntelligence(tacArmy.address, "RESPONSE TO FIELD DATA #1: Acknowledged, reinforcements en route.");

    console.log("Demo Seeding Complete!");
}

main().catch((error) => {
    console.error('Demo seeding failed:', error);
    process.exit(1);
});
