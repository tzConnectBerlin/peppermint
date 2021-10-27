import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const { Pool } = require('pg');

//const GET_PENDING_SQL = "SELECT * FROM operations WHERE state = 'pending' AND originator = $1 ORDER BY submitted_at ASC LIMIT $2"
const CHECKOUT_SQL = "WITH cte AS (SELECT id FROM operations WHERE state='pending' AND originator=$1 ORDER BY id ASC LIMIT $2) UPDATE operations AS op SET state = 'processing' FROM cte WHERE cte.id = op.id RETURNING *";
const SENT_SQL = "UPDATE operations SET state = 'waiting', included_in = $1 WHERE id = ANY($2)"
const SET_STATE_SQL = "UPDATE operations SET state = $1 WHERE id = ANY($2)"

export default function(db_connection) {
	let pool = new Pool(db_connection);

	const set_state = async function(ids, state) {
			return pool.query(SET_STATE_SQL, [ state, ids ]);
	};

	const checkout = async function(originator, limit) {
			let result = await pool.query(CHECKOUT_SQL, [originator, limit]);
			return result.rows;
	};

	const save_sent = function(ids, op_hash) {
			return pool.query(SENT_SQL, [op_hash, ids]);
	};

	const save_confirmed = function(ids) {
			return set_state(ids, 'confirmed');
	};

	const save_rejected = function(ids) {
			return set_state(ids, 'rejected');
	};

	const save_failed = function(ids) {
			return set_state(ids, 'failed');
	};

	return {
			checkout,
			save_rejected,
			save_sent,
			save_confirmed,
			save_failed
	};
}