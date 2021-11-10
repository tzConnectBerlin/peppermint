
const example = '[{"kind":"temporary","id":"failure","msg":"Error while applying operation ooSDQwbdToAQA83324mN26j4Mnp4hAyroq8NCk3PuFRTJ8XiQQu:\\nbranch delayed (Error:\\n                  { \\"id\\": \\"proto.010-PtGRANAD.gas_exhausted.block\\",\\n  \\"description\\":\\n    \\"The sum of gas consumed by all the operations in the block exceeds the hard gas limit per block\\",\\n  \\"data\\": {} }\\n)"}]\n'

const parsed = JSON.parse(example);

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
	return Object.assign({ msg_json: json_part }, err);
}

console.log(parse_error_object(parsed[0]));