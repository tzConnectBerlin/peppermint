import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const { Pool } = require('pg');
const { MongoClient, ObjectID } = require('mongodb')

import util from 'util'

//const GET_PENDING_SQL = "SELECT * FROM operations WHERE state = 'pending' AND originator = $1 ORDER BY submitted_at ASC LIMIT $2"
const CHECKOUT_SQL = "WITH cte AS (SELECT id FROM peppermint.operations WHERE state='pending' AND originator=$1 ORDER BY id ASC LIMIT $2) UPDATE peppermint.operations AS op SET state = 'processing' FROM cte WHERE cte.id = op.id RETURNING *";
const SENT_SQL = "UPDATE peppermint.operations SET included_in = $1 WHERE id = ANY($2)"
const SET_STATE_SQL = "UPDATE peppermint.operations SET state = $1 WHERE id = ANY($2)"

const KILL_CANARIES_SQL = "DELETE FROM peppermint.operations WHERE state='canary' AND originator = $1"

export default async function(db_connection) {
	let pool

	let client
	let operationsCollection


	if (db_connection.databaseType == 'mongodb') {
		async function mdb() {
			client = new MongoClient(db_connection.mongodb.url)
			await client.connect()
			const db = client.db(db_connection.mongodb.database)
			operationsCollection = db.collection('operations')
		}
		await mdb()
	} else {
		pool = new Pool(db_connection);
	}


	const save_state = async function(ids, state) {
		console.log('save_state',ids,state)
		if (db_connection.databaseType=='mongodb') {
			return operationsCollection.updateMany(
				{ _id: {$in: ids} },
				{
					$set: { state, updatedAt:new Date() },
				}
			)
		} else {
			return pool.query(SET_STATE_SQL, [ state, ids ]);
		}
	};

	const checkout = async function(originator, limit) {
		if (db_connection.databaseType=='mongodb') {
			const query = {state:'pending', originator}
			console.log('query',query)
			const result = await operationsCollection.find(query).sort({createdAt:1}).limit(limit).toArray() //project(fields).
			console.log('result',util.inspect(result, {showHidden: false, depth: null, colors: true}))
			if (Array.isArray(result)) {
				await operationsCollection.updateMany(
					{ _id: {$in:result.map( row => row._id) } },
					{
						$set: { state: 'processing', updatedAt:new Date()  },
					}
				)
			}
			return result
} else {
			let result = await pool.query(CHECKOUT_SQL, [originator, limit]);
			return result.rows;
		}
	};

	const save_sent = function(ids, op_hash) {
		if (db_connection.databaseType=='mongodb') {
			return operationsCollection.updateMany(
				{ _id: {$in: ids} },
				{
					$set: { included_in: op_hash, updatedAt:new Date() },
				}
			)
		} else {
			return pool.query(SENT_SQL, [op_hash, ids]);
		}
	};

	const kill_canaries = function(originator) {
		if (db_connection.databaseType=='mongodb') {
			return operationsCollection.deleteMany({state: 'canary', originator})
		} else {
			return pool.query(KILL_CANARIES_SQL, [ originator ]);
		}
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
			state
	};
}