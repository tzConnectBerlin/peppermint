//import { TezosToolkit } from "@taquito/taquito";
import { MichelsonMap } from '@taquito/taquito'
import { char2Bytes } from '@taquito/utils'
// import { createRequire } from 'module'
// const require = createRequire(import.meta.url);

// const hex = require('string-hex');
// const utf8 = require('utf8')

export default async function(tezos, nft_address) {
	let nft_contract = await tezos.contract.at(nft_address);
	console.log("token contract loaded", nft_contract.parameterSchema.ExtractSignatures());

	let contract_ops = {
		create_token: nft_contract.methods.create_token,
		mint_tokens: nft_contract.methods.mint_tokens,
		transfer_tokens: nft_contract.methods.transfer
	}

	for (let [key, value] in Object.entries(contract_ops)) {
		if (typeof value != 'function') {
			throw new Error("Invalid token contract signature");
		}
	}

	let create_token = function(token_id, metadata_ipfs) {
		let token_info = MichelsonMap.fromLiteral({"": char2Bytes(metadata_ipfs)});
		let create_op = contract_ops.create_token(token_id, token_info);
		return create_op;
	}

	return {
		mint: function({ token_id, to_address, metadata_ipfs, amount }, batch) {
			if (!amount) {
				amount = 1;
			}
			let create_op = create_token(token_id, metadata_ipfs);
			let mint_op = contract_ops.mint_tokens([{ owner: to_address, token_id, amount }]);
			batch.withContractCall(create_op);
			batch.withContractCall(mint_op);
			return true;
		},
		mint_multiple: function({ token_id, metadata_ipfs, destinations }, batch) {
			let create_op = create_token(token_id, metadata_ipfs);
			batch.withContractCall(create_op);
			let mint_args = destinations.map(e => ({ token_id, owner: e.to_address, amount: e.amount }));
			let mint_op = contract_ops.mint_tokens(mint_args);
			batch.withContractCall(mint_op);
			return true;
		},
		transfer: function({ token_id, from_address, to_address, amount }, batch) {
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
			batch.withContractCall(transfer_tokens(transfer_arg));
			return true;
		}
	};
}