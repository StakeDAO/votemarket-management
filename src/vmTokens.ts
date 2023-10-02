import fs from "fs";
import dotenv from "dotenv";
import { agnosticFetch } from "./utils/agnosticUtils";
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { parseAbi } from 'viem'

dotenv.config();

const client = createPublicClient({
    chain: mainnet,
    transport: http("https://eth.llamarpc.com"),
    batch: {
        multicall: true
    }
});

const abi = parseAbi([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
  ]);

const CONTRACTS = [
    "0x0000000895cB182E6f983eb4D8b4E0Aa0B31Ae4c",
    "0x00000004E4FB0C3017b543EF66cC8A89F5dE74Ff",
    "0x0000000446b28e4c90dbf08ead10f3904eb27606",
    "0x00000008eF298e2B6dc47E88D72eeB1Fc2b1CA7f",
    "0x000000060e56DEfD94110C1a9497579AD7F5b254",
    "0x000000071a273073c824E2a8B0192963e0eEA68b"
];

const main = async () => {
    const rewardTokensResp = (await agnosticFetch(`
    with 
    (
       ${CONTRACTS.map((contract: string) => "'" + contract + "'")}
    ) as bribe_contracts
    select
        distinct(input_3_value_address as rewardToken)
    from evm_events_ethereum_mainnet
    where 
        address IN bribe_contracts and
        signature = 'BountyCreated(uint256,address,address,address,uint8,uint256,uint256,uint256,bool)'
    `))
    .flat();

    const contracts = rewardTokensResp.map((rewardToken: string) => {
        return [
            {
                address: rewardToken,
                abi,
                functionName: "symbol"
            },
            {
                address: rewardToken,
                abi,
                functionName: "name"
            },
            {
                address: rewardToken,
                abi,
                functionName: "decimals"
            }
        ]
    })
    .flat();

    const results = await client.multicall({contracts});
    
    const data = rewardTokensResp.map((address: string) => {
        const symbol = results.shift()?.result as string;
        const name = results.shift()?.result as string;
        const decimals = results.shift()?.result as number;

        return {
            symbol, 
            name,
            decimals,
            address
        }
    });

    fs.writeFileSync("./data/vmTokens.json", JSON.stringify(data));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});