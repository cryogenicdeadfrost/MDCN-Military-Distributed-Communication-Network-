export const sendBatchWithNonceControl = async ({ signer, makeTxCalls, onProgress }) => {
  if (!signer) {
    throw new Error('No signer available for batch send.');
  }

  const from = await signer.getAddress();
  let nextNonce = await signer.getTransactionCount('pending');

  const txs = [];
  for (let index = 0; index < makeTxCalls.length; index += 1) {
    const makeTx = makeTxCalls[index];
    onProgress?.({ stage: 'sending', index, nonce: nextNonce });
    const tx = await makeTx({ nonce: nextNonce });
    nextNonce += 1;
    txs.push(tx);
    onProgress?.({ stage: 'sent', index, hash: tx.hash, from });
  }

  const receipts = [];
  for (let index = 0; index < txs.length; index += 1) {
    const receipt = await txs[index].wait();
    receipts.push(receipt);
    onProgress?.({ stage: 'confirmed', index, hash: txs[index].hash, blockNumber: receipt.blockNumber });
  }

  return { txs, receipts, from };
};

export const roleProfileFromIndex = (index = 0) => {
  if (index <= 2) {
    return { role: 'Strategic', section: 'Main Command Centre' };
  }
  if (index <= 10) {
    return { role: 'Operational', section: 'Coordination and Operations' };
  }
  return { role: 'Tactical', section: 'Field and Tactical Ops' };
};

export const branchFromIndex = (index = 0) => {
  const branchId = (Number(index) % 3) + 1;
  if (branchId === 1) return { id: 1, name: 'Army' };
  if (branchId === 2) return { id: 2, name: 'Navy' };
  return { id: 3, name: 'Air Force' };
};
