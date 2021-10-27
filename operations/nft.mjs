import { TezosToolkit } from "@taquito/taquito";

export default async function(tezos, nft_address) {
	let nft_contract = await tezos.contract.at(nft_address);

	return {
		mint: async function({ token_id, from_address, metadata_ipfs }, batch) {
			let token_def = {
				from_: token_id,
				to_: token_id
			};
			let metadata = {
				token_id: token_id,
				token_info: {
					" ": utf8.encode(metadata_ipfs)
				}

			};
			batch.withContractCall(nft_contract.methods.mint(token_def, metadata, [from_address]));
			return true;
		},
		transfer: async function({ token_id, from_address, to_address }, batch) {
			let transfer_arg = [
                {
                    from_: from_address,
                    txs: [
                        {
                            to_: to_address,
                            token_id: token_id,
                            amount: 1
                        }
                    ]
                }
            ];
			batch.withContractCall(nft_contract.methods.transfer(transfer_arg));
			return true;
		}
	};
}