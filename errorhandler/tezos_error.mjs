
const example = '[{"kind":"temporary","id":"failure","msg":"Error while applying operation ooSDQwbdToAQA83324mN26j4Mnp4hAyroq8NCk3PuFRTJ8XiQQu:\\nbranch delayed (Error:\\n                  { \\"id\\": \\"proto.010-PtGRANAD.gas_exhausted.block\\",\\n  \\"description\\":\\n    \\"The sum of gas consumed by all the operations in the block exceeds the hard gas limit per block\\",\\n  \\"data\\": {} }\\n)"}]\n'

const parse_error_object = function(err) {
	let msg = err.msg;
	if (!msg) {
		return null;
	}
	msg = msg.replace(/\n|\r/g, " ");
	let json_part = msg.match(/{.*}/g);
	if (!json_part) {
		return null;
	}
	try {
		json_part = JSON.parse(json_part);
	} catch {
		return null;
	}
	return Object.assign(json_part, { original_body: err });
}

const parse_rpc_error = function(json_body) {
	let parsed_errors = json_body.map(parse_error_object);
	if (parsed_errors.length == 1) {
		return parsed_errors[0];
	}
	return {
		id: 'multiple',
		errors: parsed_errors
	}
}

console.log(parse_rpc_error(JSON.parse(example)));