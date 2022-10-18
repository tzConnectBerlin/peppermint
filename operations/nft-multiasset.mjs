//import { TezosToolkit } from "@taquito/taquito";
import { MichelsonMap, TezosPreapplyFailureError } from '@taquito/taquito'
import { char2Bytes } from '@taquito/utils'
// import { createRequire } from 'module'
// const require = createRequire(import.meta.url);

// const hex = require('string-hex');
// const utf8 = require('utf8')

export default async function(tezos, { contract_address }, pool) {
	let nft_contract = await tezos.contract.at(contract_address);
	console.log("token contract loaded", nft_contract.parameterSchema.ExtractSignatures());

	let contract_ops = {
		create_token: nft_contract.methods.create_token,
		mint_tokens: nft_contract.methods.mint_tokens,
		transfer_tokens: nft_contract.methods.transfer
	}

	// Object.entries(contract_ops).forEach(([key, value]) => {
	// 	if (typeof value != 'function') {
	// 		throw new Error("Invalid token contract signature");
	// 	}
	// });

	let create_token = function(token_id, metadata_ipfs) {
		if (typeof contract_ops.create_token != 'function') {
			throw new Error("No create_token entrypoint on contract");
		}
		let token_info = MichelsonMap.fromLiteral({"": char2Bytes(metadata_ipfs)});
		let create_op = contract_ops.create_token(token_id, token_info);
		return create_op;
	};

	let mint_token = function(token_id, to_address, amount = 1) {
		if (typeof contract_ops.mint_tokens != 'function') {
			throw new Error("No mint_tokens entrypoint on contract");
		}
		let mint_op = contract_ops.mint_tokens([{ owner: to_address, token_id, amount }]);
		return mint_op;
	};

	let burn_token = function(token_id, from_address, amount = 1) {
		if (typeof contract_ops.burn_tokens != 'function') {
			throw new Error("No mint_tokens entrypoint on contract");
		}
		let burn_op = contract_ops.burn_tokens([{ owner: from_address, token_id, amount }]);
		return burn_op;
	};

	const transfer = function({ token_id, from_address, to_address, amount }, batch) {
			if (typeof contract_ops.transfer_tokens != 'function') {
				throw new Error("No transfer_tokens entrypoint on contract");
			}
			if (!amount) {
				amount = 1;
			}
			let transfer_arg = [
				{
					from_: from_address,
					txs: [
						{
							to_: to_address,
							token_id,
							amount
						}
					]
				}
			];
			batch.withContractCall(contract_ops.transfer_tokens(transfer_arg));
			return true;
	}

	let do_thing = async function(from_address, to_address, batch) {
		const client = await pool.connect();

		const FIND_UNALLOCATED_ROW = "SELECT * FROM nfts where recipient IS NULL ORDER BY id limit 1"
		const UPDATE_RECIPIENT_SQL = "UPDATE nfts SET recipient = $1 where token_id = $2 and recipient IS NULL"

		try {
			const unallocatedRowResult =  await client.query(FIND_UNALLOCATED_ROW);
			const unallocatedRows = unallocatedRowResult.rows;

			if (unallocatedRows.length !== 1) {
				throw new Error('Could not get an unallocated row')
			}

			const { token_id: unallocatedTokenId } = unallocatedRows[0];

			const values = [to_address, unallocatedTokenId];
			await client.query('BEGIN');
			const result = await client.query(UPDATE_RECIPIENT_SQL, values);

			const updateSuccessful = result.rowCount === 1;

			if (!updateSuccessful) {
				throw new Error('No row updated, transaction aborted');
			}

			transfer({ token_id: unallocatedTokenId, from_address, to_address }, batch);

			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release()
		}
	}

	return {
		create: function({ token_id, metadata_ipfs }, batch) {
			let create_op = create_token(token_id, metadata_ipfs);
			batch.withContractCall(create_op);
			return true;
		},
		mint: function({ token_id, to_address, amount }, batch) {
			let mint_op = mint_token(token_id, to_address, amount);
			batch.withContractCall(mint_op);
			return true;
		},
		create_and_mint: function({ token_id, to_address, metadata_ipfs, amount }, batch) {
			let create_op = create_token(token_id, metadata_ipfs);
			let mint_op = mint_token(token_id, to_address, amount);
			batch.withContractCall(create_op);
			batch.withContractCall(mint_op);
			return true;
		},
		create_and_mint_multiple: function({ token_id, metadata_ipfs, destinations }, batch) {
			let create_op = create_token(token_id, metadata_ipfs);
			let mint_args = destinations.map(e => ({ token_id, owner: e.to_address, amount: e.amount }));
			let mint_op = contract_ops.mint_tokens(mint_args);
			batch.withContractCall(create_op);
			batch.withContractCall(mint_op);
			return true;
		},
		transfer,
		burn: function({ token_id, from_address, amount }, batch) {
			let burn_op = burn_token(token_id, from_address, amount);
			batch.withContractCall(burn_op);
			return true;
		},
	};
}
