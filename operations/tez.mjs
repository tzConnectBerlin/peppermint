import { TezosToolkit } from "@taquito/taquito";

export default async function(_) {
	return {
		transfer: async function({ to_address, amount }, batch) {
			let transfer_arg = {
				to: to_address,
				amount: amount
			}
			batch.withTransfer(transfer_arg)
			return true;
		}
	};
}