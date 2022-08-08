import { createRequire } from 'module'
import { TezosToolkit } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer'

const require = createRequire(import.meta.url);
require('console-stamp')(console);

const GAS_SAFETY_FACTOR = 0.05;
const OPG_FEE_MARGIN = 6000;
const FEE_PER_GAS = 0.1;
const FEE_PER_BYTE = 1;
const BASE_FEE = 100;

const set_better_limits = function(op, estimate) {
	let milligas_margin = Math.max(estimate._milligasLimit * GAS_SAFETY_FACTOR, 100000);
	let gas_limit = Math.ceil((estimate._milligasLimit + milligas_margin) / 1000);
	op.gasLimit = gas_limit;
	op.storageLimit = estimate._storageLimit;
	op.fee = Math.ceil(estimate.opSize * FEE_PER_BYTE + gas_limit * FEE_PER_GAS) + BASE_FEE;
	return op;
}

const add_fee_margin = function(opg_list) {
	let opg_size = opg_list.length;
	let margin_per_op = Math.max(Math.ceil(OPG_FEE_MARGIN / opg_size), BASE_FEE);
	opg_list.foreach((op) => {
		let fee = op.fee + margin_per_op;
		op.fee = fee;
	});
	return opg_list
}

const operations = {
	tez_transfer: function({ to, amount }) {
		return {
			to,
			amount
		};
	}
};

const init = async function(config) {
	let tezos = new TezosToolkit(config.rpcUrl);
	let signer = new InMemorySigner(config.privateKey);
	let address = await signer.publicKeyHash();
	tezos.setSignerProvider(signer);

	// try {
	// 	let est = await tezos.estimate.transfer({ from: address, to: 'tz2KmhM6HHkBCRzN1mkyGfB1vTPid4PNvAbc', amount: 0.1});
	// 	console.log(est);
	// } catch (err) {
	// 	console.log(err);
	// }

	let contract = await tezos.contract.at('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS');
	try {
		let params = [{
			from_: address,
			txs: [
				{
					to_: 'tz2KmhM6HHkBCRzN1mkyGfB1vTPid4PNvAbc',
					token_id: 121,
					amount: 1
				}
			]
		}];
		let op = contract.methods.transfer(params).toTransferParams()
		let est = await tezos.estimate.transfer(op);
		console.log(est);
		console.log({
			burnFeeMutez: est.burnFeeMutez,
			gasLimit: est.gasLimit,
			minimalFeeMutez: est.minimalFeeMutez,
			storageLimit: est.storageLimit,
			suggestedFeeMutez: est.suggestedFeeMutez,
			totalCost: est.totalCost,
			usingBaseFeeMutez: est.usingBaseFeeMutez});
		op = set_better_limits(op, est);
		console.log(JSON.stringify(op));
		let rec = await tezos.wallet.transfer(op).send();
		console.log(rec.opHash);
		let rec2 = await rec.confirmation(2);
		console.log(JSON.stringify(rec2));
	} catch (err) {
		console.log(err);
	}
}

let config = require('./config.json');
console.log("Starting with configuration:\n", config);
init(config);