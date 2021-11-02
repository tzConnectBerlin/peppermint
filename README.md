# TokenManager batch engine

We made this thing for the purpose of minting and transferring NFTs, transferring tez, and potentially other purposes (such as transferring fungible tokens, etc.)

It polls a database for work to do at a configured minimum interval (but will always wait for a batch to be confirmed before pulling another one). Currently it runs with an unencrypted private key in an in-memory signer, it's not nice but it's fast, and the signer is relatively simple to replace if needed (but it has to be able to sign without user input - so hardware wallets won't work, sorry).

## Work queue

The database table used for queuing work is defined as a Postgres schema in `database/schema.sql`.

To add a new work item, fill in the follwing fields:
- `originator`: The address the operation should be originated from. A process will only pull work with an `originator` value that matches the address of its signer
- `command`: A json structure, with the following fields:
  - `handler`: The name of the module that implements this type of operation (rn we have `nft` and `tez`)
  - `name`: The name of the function on the handler that can generate the operation (eg. `transfer`, `mint`)
  - `args`: The arguments expected by the handler function (eg. from, to, metadata, etc.)

(eg, in pg.js, the parametric statement would look like `INSERT INTO operations (originator, command) VALUES ($1, $2)`)

In the current state of the codebase, failed operations won't be retried.

### Command JSON for minting NFTs

{
	"handler": "nft",
	"name": "mint",
	"command": {
	"token_id": 1, // integer token id
	"to_address" : "tz1xxx", // Tezos address to which the NFT will be assigned
	"metadata_ipfs": "ipfs://xxx" // ipfs URI pointing to TZIP-16 metadata
	}
}

### Command JSON for transferring NFTs

{
	"handler": "nft",
	"name": "transfer",
	"command": {
	"token_id": 1, // integer token id
	"from_address" : "tz2xxx", // Tezos address from which the NFT will be transferred
	"to_address" : "tz1xxx", // Tezos address to which the NFT will be transferred
	}
}

### Command JSON for transferring tez

{
	"handler": "tez",
	"name": "transfer",
	"command": {
		"amount": 100.0 // Js number tez amount
		"to_address": "tz1xxx" // Address where the tez will be transferred
	}
}