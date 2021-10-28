#!/bin/bash

for i  in `seq 21000000 21000999`; do
    LINE=$(cat <<EOL
INSERT INTO operations (originator, command) VALUES ('tz1RjonN5qEJM8cZhKcfGyoEqhw1FNB4ti6w', '{ "args": { "token_id":  $i, "to_address": "tz1PKy2PmAbq1kCdqAd59xTUe3QFGCdg9FvX", "metadata_ipfs": "ipfs://Qmb9fzHX81W2B67ZrkJK5xeFkwZwTdhvpbPHyANwLR4XCB" }, "name": "mint", "handler": "nft" }');
EOL
           )
    echo $LINE;
done
