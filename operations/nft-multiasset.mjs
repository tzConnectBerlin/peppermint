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

	let create_token = nft_contract.methods.create_token;
	if (typeof create_token != 'function') {
		throw new Error("No create_token function on linked contract.");
	}

	let mint_tokens = nft_contract.methods.mint_tokens;
	if (typeof mint_tokens != 'function') {
		throw new Error("No mint_tokens function on linked contract.");
	}

	let transfer_tokens = nft_contract.methods.transfer;
	if (typeof transfer_tokens != 'function') {
		throw new Error("No transfer function on linked contract.");
	}

	return {
		mint: function({ token_id, to_address, metadata_ipfs, amount }, batch) {
			if (!amount) {
				amount = 1;
			}
			let token_info = MichelsonMap.fromLiteral({"": char2Bytes(metadata_ipfs)});
			let create_op = create_token(token_id, token_info);
			let mint_op = mint_tokens([{ owner: to_address, token_id, amount }]);
			batch.withContractCall(create_op);
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