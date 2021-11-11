//const example_1 = '[{"kind":"temporary","id":"failure","msg":"Error while applying operation ooSDQwbdToAQA83324mN26j4Mnp4hAyroq8NCk3PuFRTJ8XiQQu:\\nbranch delayed (Error:\\n                  { \\"id\\": \\"proto.010-PtGRANAD.gas_exhausted.block\\",\\n  \\"description\\":\\n    \\"The sum of gas consumed by all the operations in the block exceeds the hard gas limit per block\\",\\n  \\"data\\": {} }\\n)"}]\n'
//const example_2 = '[{"kind":"permanent","id":"node.prevalidation.oversized_operation","size":139096,"max_size":32768}]\n';

const parse_error_object = function(err) {
	let msg = err.msg;
	if (msg) {
		msg = msg.replace(/\n|\r/g, " ");
		let json_part = msg.match(/{.*}/g);
		if (!json_part) {
			return null;
		}
		try {
			json_part = JSON.parse(json_part);
		} catch {
			console.debug("Error while parsing node error message:", err);
			return null;
		}
		return Object.assign(json_part, { container: err });
	} else if (err.kind) {
		return err;
	} else {
		return null;
	}
}

export const postprocess_error_object = function(err) {
	let id_noproto = err.id.replace(/proto\.[^.]+\./g, "");
	return Object.assign({ id_noproto }, err);
}

export const parse_rpc_error = function(text_body) {
	try {
		let json_body = JSON.parse(text_body);
		let parsed_errors = json_body.map(parse_error_object).filter(e => e).map(postprocess_error_object);
		switch (parsed_errors.length) {
			case 0:
				return null;
			case 1:
				return Object.assign(parsed_errors[0]);
			default:
				return {
					id: 'multiple',
					errors: parsed_errors
				}
		}
	} catch (err) {
		console.debug("Error while parsing error message:", err);
		return null;
	}
}

