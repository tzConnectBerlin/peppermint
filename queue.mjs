import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const { Pool } = require('pg');

//const GET_PENDING_SQL = "SELECT * FROM operations WHERE state = 'pending' AND originator = $1 ORDER BY submitted_at ASC LIMIT $2"
const CHECKOUT_SQL = "WITH cte AS (SELECT id FROM peppermint.operations WHERE state='pending' AND originator=$1 ORDER BY id ASC LIMIT $2) UPDATE peppermint.operations AS op SET state = 'processing' FROM cte WHERE cte.id = op.id RETURNING *";
const SENT_SQL = "UPDATE peppermint.operations SET included_in = $1 WHERE id = ANY($2)";
const SET_STATE_SQL = "UPDATE peppermint.operations SET state = $1 WHERE id = ANY($2)";

const KILL_CANARIES_SQL = "DELETE FROM peppermint.operations WHERE state='canary' AND originator = $1";

const REGISTER_PROCESS_SQL = "INSERT INTO peppermint.processes (originator, process_uuid) VALUES ($1, $2) ON CONFLICT DO NOTHING";
const UNREGISTER_PROCESS_SQL = "DELETE FROM peppermint.processes WHERE originator=$1 AND process_uuid=$2";

const UPDATE_LAST_PULL = "UPDATE peppermint.processes SET messages = jsonb_set(messages, '{last_pull_at_epoch}', to_jsonb(ROUND(extract(epoch from now()::timestamptz) * 1000))) WHERE originator=$1 AND process_uuid=$2 RETURNING *";
const ADD_BALANCE_WARNING = "UPDATE peppermint.processes SET messages = jsonb_set(messages, '{balance_warning}', to_jsonb($3::TEXT)) WHERE originator=$1 AND process_uuid=$2";
const REMOVE_BALANCE_WARNING = "UPDATE peppermint.processes SET messages = messages - 'balance_warning' WHERE originator=$1 AND process_uuid=$2";

export default function(db_connection) {
	let pool = new Pool(db_connection);

	const save_state = async function(ids, state) {
		return pool.query(SET_STATE_SQL, [ state, ids ]);
	};

	const checkout = async function(originator, limit) {
		let result = await pool.query(CHECKOUT_SQL, [originator, limit]);
		return result.rows;
	};

	const save_sent = function(ids, op_hash) {
		return pool.query(SENT_SQL, [op_hash, ids]);
	};

	const kill_canaries = function(originator) {
		return pool.query(KILL_CANARIES_SQL, [ originator ]);
	};

	const register_process = async function({ originator, process_uuid }) {
		let result = await pool.query(REGISTER_PROCESS_SQL, [ originator, process_uuid ]);
		return result.rowCount;
	};

	const unregister_process = function({ originator, process_uuid }) {
		return pool.query(UNREGISTER_PROCESS_SQL, [ originator, process_uuid ]);
	};

	const update_last_pull = function({ originator, process_uuid }) {
		return pool.query(UPDATE_LAST_PULL, [ originator, process_uuid ]);
	}

	const add_balance_warning = function({ originator, process_uuid, tez_supply }) {
		const warning_message = `Tez balance of ${tez_supply} on account ${originator} is below warning threshold`;
		return pool.query(ADD_BALANCE_WARNING, [ originator, process_uuid, warning_message ])
	}

	const remove_balance_warning = function({ originator, process_uuid }) {
		return pool.query(REMOVE_BALANCE_WARNING, [ originator, process_uuid ])
	}

	const state = {
		PENDING: 'pending',
		CONFIRMED: 'confirmed',
		FAILED: 'failed',
		UNKNOWN: 'unknown',
		REJECTED: 'rejected'
	};

	return {
			checkout,
			save_sent,
			save_state,
			kill_canaries,
			register_process,
			unregister_process,
			update_last_pull,
			add_balance_warning,
			remove_balance_warning,
			state
	};
}
