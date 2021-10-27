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

In the current state of the codebase, failed operations won't be retried.
