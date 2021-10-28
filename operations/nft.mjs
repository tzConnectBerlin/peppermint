// import { MichelsonMap } from '@taquito/taquito'
// import { char2Bytes } from '@taquito/utils'

// export default async function(tezos, nft_address) {
// 	let nft_contract = await tezos.contract.at(nft_address);
// 	console.log("token contract loaded", nft_contract.parameterSchema.ExtractSignatures());

// 	let mint_tokens = nft_contract.methods.mint_tokens;
// 	if (typeof mint_tokens != 'function') {
// 		throw new Error("No mint_tokens function on linked contract.");
// 	}

// 	let transfer_tokens = nft_contract.methods.transfer;
// 	if (typeof transfer_tokens != 'function') {
// 		throw new Error("No transfer function on linked contract.");
// 	}

// 	return {
// 		mint: function({ token_id, to_address, metadata_ipfs }, batch) {
// 			let token_def = {
// 				from_: token_id,
// 				to_: token_id+1
// 			};
// 			let token_info = MichelsonMap.fromLiteral({" ": char2Bytes(metadata_ipfs)});
// 			let owners = [to_address];
// 			let op = mint_tokens(token_def.from_, token_def.to_, token_id, token_info, owners)
// 			console.log(JSON.stringify(op.toTransferParams()))
// 			batch.withContractCall(op);
// 			return true;
// 		},
// 		transfer: function({ token_id, from_address, to_address }, batch) {
// 			let transfer_arg = [
//                 {
//                     from_: from_address,
//                     txs: [
//                         {
//                             to_: to_address,
//                             token_id: token_id,
//                             amount: 1
//                         }
//                     ]
//                 }
//             ];
// 			batch.withContractCall(transfer_tokens(transfer_arg));
// 			return true;
// 		}
// 	};
// }