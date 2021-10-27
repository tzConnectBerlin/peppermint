import { App } from './app'
// declaring the constant with the node’s address
const RPC_URL = 'http://granada.newby.org:8732'
//declare the constant with a specific address
const ADDRESS = 'tz1RjonN5qEJM8cZhKcfGyoEqhw1FNB4ti6w'


//launching App, sending a link to the node, calling getBalance and sending it the address
// new App(RPC_URL).getBalance(ADDRESS)
// new App(RPC_URL).getContract('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS')

new App(RPC_URL).nft_drop('505adr.txt', 71);

// new App(RPC_URL).getContract('KT1PptVxoGBiLbtJr2kzXeUsBc2qRAsM7HKS');

// const a = new App(RPC_URL)
// let l = a.read_file('5adr.txt')
// a.write_to_file(l, 'bad_test.txt') 


