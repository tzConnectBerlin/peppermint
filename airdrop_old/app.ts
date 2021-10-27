import { ContractAbstraction, ContractProvider, TezosToolkit } from '@taquito/taquito'
import { InMemorySigner, importKey } from '@taquito/signer'

type tx_arg = [
    {
        from_: String
        txs: [
            {
                to_: String
                token_id: Number
                amount: Number
            }
        ]
    }
]

export class App {
    //declaring private tezos modifier of TezosToolkit type
    private tezos: TezosToolkit

    //declaring the File System module
    private fs = require('fs');

    //create a sleep module
    private sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


    //declaring the constructor rpcUrl that will broadcast the Tezos public node address to TezosToolkit
    constructor(rpcUrl: string) {
        this.tezos = new TezosToolkit(rpcUrl)
         //Set Provider
        this.tezos.setProvider({
            signer: new InMemorySigner('edsk4LzAuuQF1FkFHV5qXmpL8a5YNtJh1pTtkAYjAVBKCSAbp6LCCD'),
    })
  }
  

  //declaring the method getBalance with input param address
  public getBalance(address: string): void {
    //Taquito sends a request for balance to the node. If the node executed the request, the script displays the value in the console, otherwise it says “Address not found”
    this.tezos.rpc
      .getBalance(address)
      .then((balance) => console.log(`${balance.toNumber() / 1000000} ꜩ`))
      .catch((e) => console.log('Address not found'))
  }
  //Get the entrypoints of the contract
  public getContract(address: string): void {
      this.tezos.contract
        .at(address)
        .then((c) => {
            let methods = c.parameterSchema.ExtractSignatures();
            console.log(JSON.stringify(methods, null, 2))
        })
        .catch((e) => console.log(`Error: ${e}`));

  }

  // Transfer token to addres
  public transfer(transfer_arg: any): void {
      this.tezos.contract
        .at('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS')
        .then((contract) => {
            console.log(`this is transfer_arg ${transfer_arg}`)
            return contract.methods.transfer(transfer_arg).send();
        })
        .then((op) => {
            console.log(`Awaiting for ${op.hash} to be confirmed`)
            return op.confirmation(1).then(() => op.hash)
        })
        .then((hash) => console.log(`Call done}`)) //call is successful
        .catch((error) => console.log(`Error: ${JSON.stringify(error, null, 2)}`))
  }

  //Read from file and store in array
  public read_file(path: string): string[] {
      let lst_addr = this.fs.readFileSync(path).toString().split("\n");
    //   console.log(lst_addr)
      return lst_addr
  }

//Read freom array and store in file
public write_to_file(lst_of_addr: string[], path: string): void {
    lst_of_addr.forEach(addr => {
        this.fs.appendFileSync(path, addr.concat('\n'.toString()))
    });
}

  //List of transfer_arguments
  public lst_of_txs_args (lst_addresses: string[], tok_id: number): tx_arg[] {
    let txs_arg_lst: tx_arg[] = [];   
    for (let addr of lst_addresses) {
        if (addr != '') {
            let txs_arg: tx_arg = [
                {
                    from_: 'tz1RjonN5qEJM8cZhKcfGyoEqhw1FNB4ti6w',
                    txs: [
                        {
                            to_: addr,
                            token_id: tok_id,
                            amount: 1
                        }
                    ]
                }
            ]
            txs_arg_lst.push(txs_arg)
        }
        

    }
    return txs_arg_lst;
    // console.log(txs_arg_lst)

  }

  
  // Batch transfer
  public async batchTansfer(lst_txs_arg: any[], contract: ContractAbstraction<ContractProvider>) {
        try {
            // const contract = await this.tezos.contract.at('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS')

            const accumulator = this.tezos.contract.batch();
            lst_txs_arg.forEach(element => {
                accumulator.withContractCall(contract.methods.transfer(element));
            });
    
            const batchOp = await accumulator.send();

            await batchOp.confirmation(1);

            console.log(`Operation hash: ${batchOp.hash}`)
            // return batchOp
        } catch (error) {
            if (error) {
                console.log(`Error: ${JSON.stringify(error, null, 2)}`);
                throw 'stop execution'; 
                
            }
        }
  }

  public  async nft_drop(path: string, tok_id: number) {
    const lst_addresses = this.read_file(path);
    const lst_txs_arg = this.lst_of_txs_args(lst_addresses, tok_id);
    const contract = await this.tezos.contract.at('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS')
    let batch_txs = [];
    let n:number = 1;

    // lst_txs_arg.map( (txs_arg: any, index: number) => {
        
    // })
    
    for (let txs_arg of lst_txs_arg) {
        batch_txs.push(txs_arg)
        if (batch_txs.length >= 200) { // TODO: work out batch size better 191
            try {

                await this.batchTansfer(batch_txs, contract);
            } catch (error) {
                if (error) {
                    console.log(`Error_drop: ${JSON.stringify(error, null, 2)}`);
                    process.exit(); 
                    
                }

            }
            console.log(`Batch ${n} is done`);
            batch_txs = [];
            n++;            
        }
    }
    // If nr of txs is not divisble by 100, then we need to send the left overs
    if (batch_txs && batch_txs.length >=1) {
        await this.batchTansfer(batch_txs, contract);
        console.log(`Batch ${n} is done`);
    }
  }

  
  
  
  public async main() {}
}