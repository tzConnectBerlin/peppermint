import { createRequire } from 'module'
import { TezosToolkit, TezosOperationError } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer'
import { RemoteSigner } from '@taquito/remote-signer';
import { asyncExitHook } from 'exit-hook'

import Queue from './queue.mjs'
import { parse_rpc_error, postprocess_error_object } from './errorhandler/tezos_error.mjs'
import MultiassetHandler from './operations/nft-multiasset.mjs'
import TezHandler from './operations/tez.mjs'
import ConfLoader from './confloader.mjs'
import ProcMgr from './procmgr.mjs'

const Handlers = {
	MultiassetHandler,
	TezHandler
}

const require = createRequire(import.meta.url);
const promptly = require('promptly');
require('console-stamp')(console);
const config = ConfLoader();

const get_signing_key = async function(config) {
  if (config.privateKey) {
	  try {
		  const signer = new InMemorySigner(config.privateKey);
		  return signer;
	  } catch (err) {
		  if (err.name == 'InvalidPassphraseError') {
			  const pass = await promptly.prompt('Passphrase: ', { silent: true });
			  const signer = InMemorySigner.fromSecretKey(config.privateKey, pass);
			  return signer;
		  } else {
			  throw (err);
		  }
	  }
  } else {
	const signer = new RemoteSigner(
		config.remoteSigner.pkh,
		config.remoteSigner.rootUrl,
		{ headers: config.remoteSigner.headers }
	);
	return signer;
  }
}


const main = async function() {

  let batch_divider = 1;

  const queue = Queue(config.dbConnection);
  const tezos = new TezosToolkit(config.rpcUrl);

  const signer = await get_signing_key(config)
  console.log("signer: " + signer);
  const address = await signer.publicKeyHash();
  console.log("Signer initialized for originating address ", address);
	tezos.setSignerProvider(signer);

	const procmgr = ProcMgr({ db: queue, originator: address, config });
	const process_uuid = procmgr.get_process_uuid();

	let handlers = {};
	for (let key in config.handlers) {
		let val = config.handlers[key];
		handlers[key] = await (Handlers[val.handler](tezos, val.args));
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

	const update_last_pull = function() {
		queue.update_last_pull({ originator: address, process_uuid }).catch(() => { console.error("Database error when updating last pull epoch"); });
	}

	const save_state_async = function(ids, state) {
		queue.save_state(ids, state).catch((err) => { console.error("Database error when setting", state, "on operation with ids:", JSON.stringify(ids)); });;
	}

	const health_check = async function() {
		let tez_supply = 0;
		try {
			let mutez_supply = await tezos.tz.getBalance(address);
			tez_supply = mutez_supply.shiftedBy(-6).toNumber();
		} catch (err) {
			console.log("An error has occurred while attempting to get tez balance; the node may be down or inaccessible.\n", err);
			return false;
		}

		if (tez_supply > config.warnBelowTez) {
			// all okay <3
			await queue.remove_balance_warning({ originator: address, process_uuid })
			await queue.kill_canaries(address);
		} else {
			await queue.add_balance_warning({ originator: address, process_uuid, tez_supply });
			console.warn(`Tez balance on account ${address} below warning threshold`);
		}

		return true;
	};

	const heartbeat = async function() {
		if (!await health_check()) {
			return true;
		}

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
			let sent_operation = await batch.send();
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

	asyncExitHook(() => {
		console.log("Attempting clean exit...");
		return procmgr.unregister();
	}, { minimumWait: 1000 });

	await procmgr.register();
	while (true) {
		await Promise.all([
			update_last_pull(),
			heartbeat(),
			new Promise(_ => setTimeout(_, config.pollingDelay))
		]);
	}

};

main().then(() => { console.log("bye!"); }).catch((err) => { console.log("An error has ocurred outside the main event loop.\n", err) });
