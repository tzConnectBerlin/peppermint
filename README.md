# Peppermint batch engine

We made this thing for the purpose of minting and transferring NFTs, transferring tez, and potentially other purposes (such as transferring fungible tokens, etc.)

It polls a database for work to do at a configured minimum interval (but will always wait for a batch to be confirmed before pulling another one). Currently it runs with an unencrypted private key in an in-memory signer, it's not nice but it's fast, and the signer is relatively simple to replace if needed (but it has to be able to sign without user input - so hardware wallets won't work, sorry).

## Prerequisites
- node.js version 16+
- npm 7+
- postgresql (tested with version 12)

## Installation

In this directory 

`npm install`

create your database schema:

`psql $DATABASE_NAME` < database/schema.sql`

## Configuration

When loading the configuration, the process looks at the environment variable `PEPPERMINT_PROFILE`. If this variable is not set, the file `config.json` is loaded. If profile is set, the process looks for the file `config_{profile}.json`.

This version of Peppermint allows multiple instances of handlers to be configured via `config.json`. In the `handlers` section, one can add multiple instances of the same handler module with different arguments, under different names. The names specified here will be used as the handler names in the SQL commands.

At this moment, to reduce complexity, handler modules are *not* auto-populated from the `operations` folder, but imported manually in `app.mjs` - so when adding new, custom handler modules, these need to be specifically imported and added to the `Handlers` object in that file.

## How to run

`node app.mjs`

## Work queue

The database table used for queuing work is defined as a Postgres schema in `database/schema.sql`.

To add a new work item, fill in the follwing fields:
- `originator`: The address the operation should be originated from. A process will only pull work with an `originator` value that matches the address of its signer
- `command`: A json structure, with the following fields:
  - `handler`: The name of the handler instance to invoke (configured via the `handlers` section in `config.json`)
  - `name`: The name of the function on the handler that can generate the operation (eg. `transfer`, `mint`)
  - `args`: The arguments expected by the handler function (eg. from, to, metadata, etc.)

(eg, in pg.js, the parametric statement would look like `INSERT INTO peppermint.operations (originator, command) VALUES ($1, $2)`)

In the current state of the codebase, failed operations won't be retried except for a few known retriable fail states (known Octez glitches, no tez in minter account).

Modules for handling contract types can be added under `operations`. The handler modules included in this version are:
- FA2 multi-asset (as 'nft' - we know it's a misnomer, but it's what it is for now)
- tez (for plain tez transfers)

For now, the code is the documentation. We're truly sorry. More documentation will come in due time. In the meantime, here are some example operations you can do:

### Command JSON for minting NFTs

```
{
	"handler": "nft",
	"name": "create_and_mint",
	"args": {
		"token_id": 1, // integer token id
		"to_address" : "tz1xxx", // Tezos address to which the NFT will be assigned
		"metadata_ipfs": "ipfs://xxx" // ipfs URI pointing to TZIP-16 metadata
		"amount" : 1 // (optional) integer amount of edition size to be minted
	}
}
```

### Command JSON for transferring NFTs

```
{
	"handler": "nft",
	"name": "transfer",
	"args": {
		"token_id": 1, // integer token id
		"from_address" : "tz2xxx", // Tezos address from which the NFT will be transferred
		"to_address" : "tz1xxx", // Tezos address to which the NFT will be transferred
		"amount" : 1 // (optional) integer amount of tokens to transfer
	}
}
```

### Command JSON for transferring tez

```
{
	"handler": "tez",
	"name": "transfer",
	"args": {
		"amount": 100.0 // Js number tez amount
		"to_address": "tz1xxx" // Address where the tez will be transferred
	}
}
```
