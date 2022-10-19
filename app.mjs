import { createRequire } from 'module'
import { TezosToolkit, TezosOperationError } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer'

import Queue from './queue.mjs'
import { parse_rpc_error, postprocess_error_object } from './errorhandler/tezos_error.mjs'
import MultiassetHandler from './operations/nft-multiasset.mjs'
import TezHandler from './operations/tez.mjs'
import ConfLoader from './confloader.mjs'

const Handlers = {
  MultiassetHandler,
  TezHandler
}

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const promptly = require('promptly');
require('console-stamp')(console);
const config = ConfLoader();

const get_signing_key = async function(config) {
  try {
    const signer = new InMemorySigner(config.privateKey);
    return signer;
  } catch (err) {
    if (err.name == 'InvalidPassphraseError') {
      const pass = await promptly.prompt('Passphrase: ', { silent: true });
      const signer = InMemorySigner.fromSecretKey(config.privateKey, pass);
      return signer;
    } else {
      throw(err);
    }
  }
}


const main = async function() {

  let batch_divider = 1;

  const signer = await get_signing_key(config)
  const pool = new Pool(config.dbConnection);
  const queue = Queue(pool, signer.publicKeyHash());
  const tezos = new TezosToolkit(config.rpcUrl);

  console.log("signer: " + signer);
  const address = await signer.publicKeyHash();
  console.log("Signer initialized for originating address ", address);
  tezos.setSignerProvider(signer);

  let handlers = {};
  for (let key in config.handlers) {
    let val = config.handlers[key];
    handlers[key] = await (Handlers[val.handler](tezos, val.args, pool));
  }

  const dispatch_command = function(command, batch) {
    let handler = handlers[command.handler];
    if (handler) {
      let handling_function = handler[command.name];
      if (handling_function) {
	return handling_function(command.args, batch);
      }
    }
    console.warn("Invalid comand:", JSON.stringify(command));
    return false;
  }

  const save_state_async = function(ids, state) {
    queue.save_state(ids, state).catch((err) => { console.error("Database error when setting", state, "on operation with ids:", JSON.stringify(ids)); });;
  }

  const heartbeat = async function() {
    await queue.kill_canaries();

    let ops = await queue.checkout(address, ~~(config.batchSize/batch_divider) + 1);
    if (ops.length == 0) {
      console.log("No pending operations for originator", address);
      return true;
    }

    console.log("Generating batch with", ops.length, "operations.")
    let batch = tezos.wallet.batch();
    let batched_ids = [];
    let rejected_ids = [];
    await Promise.all(ops.map((operation) => {

      let success = dispatch_command(operation.command, batch);


      if (success) {
	batched_ids.push(operation.id);
      } else {
	rejected_ids.push(operation.id);
      }
    }));

    // Ideally the handlers should have filtered out obviously bad ops
    if (rejected_ids.length > 0) {
      console.warn('Rejected operations with ids:', JSON.stringify(rejected_ids));
      save_state_async(rejected_ids, queue.state.REJECTED);
    }
    if (batched_ids.length == 0) {
      console.log("No valid operations left, aborting batch.");
      return true;
    }

    console.log("Attempting to send operation group containing operations with ids:", JSON.stringify(batched_ids));
    try {
            console.log("foo");
      let sent_operation = await batch.send();
            console.log("bar");
      let op_hash = sent_operation.opHash;
      console.log("Sent operation group with hash", op_hash, "containing operations with ids:", JSON.stringify(batched_ids));

      // Save operation group hash - async because it's okay if it happens later
      queue.save_sent(batched_ids, sent_operation.opHash).catch( (err) => { console.error("Database error when writing hash", sent_operation.opHash, "to sent operations with ids:", JSON.stringify(batched_ids)); } );

      // Wait for it to be baked
      let result = await sent_operation.confirmation(config.confirmations, config.timeout);
      if (result.completed) {
	console.log("Operation group with hash", op_hash, "has been successfully confirmed.");
	save_state_async(batched_ids, queue.state.CONFIRMED); // save state
	batch_divider = 1; // reset batch divider
	return true;
      } else {
	// FIXME: Taquito .confirmation() gives us some interesting and underdocumented results
	// it should be possible to prepare for chain reorgs based on it
	console.error("Operation group with hash", op_hash, "has failed on chain.")
	save_state_async(batched_ids, queue.state.FAILED);
      }
    } catch (err) {
      let tezos_error = null;
      if (TezosOperationError.prototype.isPrototypeOf(err)) {
	tezos_error = postprocess_error_object(err);
      } else {
	tezos_error = parse_rpc_error(err.body);
      }
      if (tezos_error) {
	switch (tezos_error.id_noproto) {
	case "node.prevalidation.oversized_operation":
	case "gas_limit_too_high":
	  // Operation group too big
	  batch_divider += 1; // Cut batch size
	case "gas_exhausted.block":
	  // Octez is having an anxiety attack
	case "contract.balance_too_low":
	case "contract.cannot_pay_storage_fee":
	  // Account has no tez in it
	case "storage_exhausted.operation":
	  // There seems to be a bug in the node that may give this error when the account is low on tez
	  console.warn("Retriable Tezos error encountered:\n", tezos_error, "\nRetrying operations with ids:", JSON.stringify(batched_ids));
	  await queue.save_state(batched_ids, queue.state.PENDING);
	  break;
	case "michelson_v1.script_rejected":
	  // The call failed on some business logic check in the contract
	default:
	  // Everything else
	  console.error("Non-retriable Tezos error encountered:\n", tezos_error, "\nRejecting operations with ids:", JSON.stringify(batched_ids));
	  save_state_async(batched_ids, queue.state.REJECTED);
	}
	return true;
      }
      console.error("An unhandled error has occurred when processing operations with ids:", JSON.stringify(batched_ids), "\n", err, "\nOperation group state unknown.");
      save_state_async(batched_ids, queue.state.UNKNOWN);
      return true;
    }
  };

  let signal = true;
  while (signal) {
    try {
      let [ result, _ ] = await Promise.all([
	heartbeat(),
	new Promise(_ => setTimeout(_, config.pollingDelay))
      ]);
      signal = result;
    } catch (err) {
      console.error("An error has occurred in the main event loop.\n", err);
      signal = false;
    }
  }

};

main().then(() => { console.log("bye!"); }).catch((err) => { console.log("An error has ocurred outside the main event loop.\n", err) });
