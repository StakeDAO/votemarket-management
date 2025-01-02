import fs from "fs";
import dotenv from "dotenv";
import { createPublicClient, http } from 'viem'
import { bsc, mainnet } from 'viem/chains'
import { parseAbi } from 'viem'

dotenv.config();

const abi = parseAbi([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function nextID() view returns (uint256)',
    'function bounties(uint256 i) view returns ((address,address,address,uint8,uint256,uint256,uint256))',
]);

const abiBsc = parseAbi([
    'function bounties(uint256 i) view returns ((address,uint256,address,address,uint8,uint256,uint256,uint256))',
]);

const CONTRACTS_PER_CHAIN_ID = [
    {
        chain: mainnet,
        rpc: "https://eth.drpc.org",
        contracts: [
            "0x0000000895cB182E6f983eb4D8b4E0Aa0B31Ae4c",
            "0x00000004E4FB0C3017b543EF66cC8A89F5dE74Ff",
            "0x0000000446b28e4c90dbf08ead10f3904eb27606",
            "0x00000008eF298e2B6dc47E88D72eeB1Fc2b1CA7f",
            "0x000000060e56DEfD94110C1a9497579AD7F5b254",
            "0x000000071a273073c824E2a8B0192963e0eEA68b"
        ]
    },
    {
        chain: bsc,
        rpc: "https://bsc-rpc.publicnode.com",
        contracts: [
            "0x0fD2d686C02D686c65804ff45E4e570386E3595f",
            "0x62c5D779f5e56F6BC7578066546527fEE590032c",
            "0xa77889DA8fEDC7FD65D37Af60d0744B954E3bAf0"
        ]
    }
]


const main = async () => {
    let allTokenRewardsData: any[] = [];

    for (const contractPerChainIdData of CONTRACTS_PER_CHAIN_ID) {
        const client = createPublicClient({
            chain: contractPerChainIdData.chain,
            transport: http(contractPerChainIdData.rpc),
            batch: {
                multicall: true
            }
        });

        const isBsc = contractPerChainIdData.chain === bsc;
        const tokenRewardAddresses: Record<string, boolean> = {};

        for (const contract of contractPerChainIdData.contracts) {
            const nextId = await client.readContract({
                address: contract as `0x${string}`,
                abi: abi,
                functionName: 'nextID',
            });

            const calls: any[] = [];
            for (let i = 0; i < Number(nextId); i++) {
                calls.push({
                    address: contract as `0x${string}`,
                    abi: isBsc ? abiBsc : abi,
                    functionName: 'bounties',
                    args: [BigInt(i)]
                });
            }

            const results = await client.multicall({ contracts: calls });

            for (const result of results) {
                if (result.status === "failure") {
                    continue;
                }

                let tokenRewardAddress = "";
                const bounty = result.result as any;
                if (isBsc) {
                    tokenRewardAddress = bounty[3];
                } else {
                    tokenRewardAddress = bounty[2];
                }

                if (tokenRewardAddress.length > 0) {
                    tokenRewardAddresses[tokenRewardAddress] = true;
                }
            }
        }

        const tokenRewards = Object.keys(tokenRewardAddresses);
        if (tokenRewards.length > 0) {
            const contracts = tokenRewards.map((rewardToken: string) => {
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
                .flat() as any[];

            const results = await client.multicall({ contracts });
            const tokenRewardsData = tokenRewards.map((address: string) => {
                let symbol = "";
                let name = "";
                let decimals = 0;

                let data = results.shift();
                if (data && data.status === 'failure') {
                    return null;
                }
                symbol = data?.result as string;

                data = results.shift();
                if (data && data.status === 'failure') {
                    return null;
                }
                name = data?.result as string;

                data = results.shift();
                if (data && data.status === 'failure') {
                    return null;
                }
                decimals = data?.result as number;

                return {
                    symbol,
                    name,
                    decimals,
                    address,
                    chainId: contractPerChainIdData.chain.id,
                }
            })
                .filter((res: any) => res !== null);

            allTokenRewardsData = allTokenRewardsData.concat(tokenRewardsData);
        }
    }
    fs.writeFileSync("./data/vmTokens.json", JSON.stringify(allTokenRewardsData));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});