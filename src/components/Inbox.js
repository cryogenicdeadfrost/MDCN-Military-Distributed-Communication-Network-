import React, { useEffect, useState } from 'react';

const Inbox = ({ contract, account, isAdmin, adminFilterRecipientGroup }) => {
  const [commands, setCommands] = useState([]);
  const [status, setStatus] = useState("");

  // For non-admin filtering.
  const [inboxRecipientGroup, setInboxRecipientGroup] = useState("1");
  const [inboxBranch, setInboxBranch] = useState("1");

  const recipientGroupMapping = {
    1: "Command Center",
    2: "Tactical Command",
    3: "Coordination Command",
    4: "Intelligence Command"
  };
  const branchMapping = {
    1: "Army",
    2: "Navy",
    3: "AirForce"
  };

  const loadCommands = async () => {
    if (!contract) return;
    try {
      const filter = contract.filters.CommandSent();
      const events = await contract.queryFilter(filter);
      let filteredEvents;
      if (isAdmin) {
        if (adminFilterRecipientGroup) {
          const groupFilter = parseInt(adminFilterRecipientGroup);
          filteredEvents = events.filter(event =>
            parseInt(event.args.recipientGroup) === groupFilter
          );
        } else {
          filteredEvents = events;
        }
      } else {
        const groupFilter = parseInt(inboxRecipientGroup);
        const branchFilter = parseInt(inboxBranch);
        filteredEvents = events.filter(event =>
          parseInt(event.args.recipientGroup) === groupFilter &&
          parseInt(event.args.branch) === branchFilter
        );
      }
      const cmds = filteredEvents.map(event => ({
        id: event.args.id.toString(),
        sender: event.args.sender,
        recipientGroup: recipientGroupMapping[parseInt(event.args.recipientGroup)],
        branch: branchMapping[parseInt(event.args.branch)],
        text: event.args.commandText,
        timestamp: new Date(event.args.timestamp.toNumber() * 1000).toLocaleString()
      }));
      setCommands(cmds);
    } catch (error) {
      console.error("Error loading commands:", error);
    }
  };

  const acknowledge = async (id) => {
    if (!contract) return;
    try {
      setStatus("Sending acknowledgment transaction...");
      const tx = await contract.acknowledgeCommand(id);
      await tx.wait();
      setStatus("Command acknowledged successfully!");
      loadCommands();
    } catch (error) {
      console.error("Acknowledge error:", error);
      setStatus("Error acknowledging command.");
    }
  };

  useEffect(() => {
    loadCommands();
  }, [contract, account, inboxRecipientGroup, inboxBranch, isAdmin, adminFilterRecipientGroup]);

  return (
    <section className="card">
      <h2>Inbox - Received Commands {isAdmin && "(Administrator Mode)"}</h2>
      {!isAdmin && (
        <>
          <div className="form-control">
            <label>Your Inbox Recipient Group:</label>
            <select value={inboxRecipientGroup} onChange={e => setInboxRecipientGroup(e.target.value)}>
              <option value="1">Command Center</option>
              <option value="2">Tactical Command</option>
              <option value="3">Coordination Command</option>
              <option value="4">Intelligence Command</option>
            </select>
          </div>
          <div className="form-control">
            <label>Your Inbox Branch:</label>
            <select value={inboxBranch} onChange={e => setInboxBranch(e.target.value)}>
              <option value="1">Army</option>
              <option value="2">Navy</option>
              <option value="3">AirForce</option>
            </select>
          </div>
        </>
      )}
      {status && <p>{status}</p>}
      {commands.length === 0 ? (
        <p>No commands found.</p>
      ) : (
        <ul>
          {commands.map(cmd => {
            let itemBorderClass = "layer-inbox";
            if (cmd.branch === "Army") itemBorderClass = "theme-army";
            else if (cmd.branch === "Navy") itemBorderClass = "theme-navy";
            else if (cmd.branch === "AirForce" || cmd.branch === "Air Force") itemBorderClass = "theme-airforce";

            return (
              <li key={cmd.id} className={`inbox-item ${itemBorderClass}`} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Command #{cmd.id}</strong>
                  <span className="immutable-tag" style={{ margin: 0 }}>Immutable</span>
                </div>
                <em>From: {cmd.sender}</em><br />
                <div style={{ padding: '10px 0' }}>{cmd.text}</div>
                <small style={{ color: '#666' }}>{cmd.timestamp}</small><br />
                <button onClick={() => acknowledge(cmd.id)} className="btn" style={{ marginTop: '10px' }}>
                  Acknowledge
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default Inbox;
