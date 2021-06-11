# Optimistic Rollup Example: ERC721

![](https://i.imgur.com/jJKCZ84.png)

## Introduction

This example demonstrates how to deploy and interact with ERC721 contract using Optimistic Rollup, including the following operations:
- **Deposit** ERC721 from L1 to L2
- **Transfer** ERC721 in L2
- **Withdraw** ERC721 from L2 to L1

Here are three other great examples:
- [Optimistic Rollup Example: ERC20](https://github.com/ccniuj/optimistic-rollup-example-erc20)
- [optimism-tutorial](https://github.com/ethereum-optimism/optimism-tutorial)
- [l1-l2-deposit-withdrawal](https://github.com/ethereum-optimism/l1-l2-deposit-withdrawal)

## Prerequisite Software

- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Node.js](https://nodejs.org/en/download/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install#mac-stable)
- [Docker](https://docs.docker.com/engine/install/)

## Build and Run Optimistic Ethereum

Everything we need to build and run Optimistic Rollup is in [Optimistic Ethereum](https://github.com/ethereum-optimism/optimism/tree/develop/ops):

```bash
$ git clone https://github.com/ethereum-optimism/optimism.git
$ cd optimism
$ yarn
$ yarn build
```

Run it when the build is done:

```bash
$ cd ops
$ docker-compose build
$ docker-compose up
```

A few services will be up, including：
- L1 Ethereum Node (EVM)
- L2 Optimistic Ethereum Node (OVM)
- Batch Submitter
- Data Transport Layer
- **Deployer**
- Relayer
- Verifier

> The environment variable `FRAUD_PROOF_WINDOW_SECONDS` in the deployer service defines how much long the user has to wait when withdrawing. Its default value is `0` second.

> Clean the docker volume when you need to restart the service. Ex: `docker-compose down -v`

### Test Optimistic Ethereum

Before we continue, we need to make sure that the Optimistic Ethereum operates normally, Especially the relayer. Use integration test to check its functionality:

```bash
$ cd optimism/integration-tests
$ yarn build:integration
$ yarn test:integration
```

Make sure all the tests related to `L1 <--> L2 Communication` passed before you continue.

> It might take a while (~ 120s) for Optimistic Ethereum to be fully operational. If you fail all the test, try again later or rebuild Optimistic Ethereum from the source again.

## Deploy ERC721 and Gateway Contracts

Next, let's deploy the contract:

```bash
$ git clone https://github.com/ccniuj/optimistic-rollup-example-erc721.git
$ cd optimistic-rollup-example-erc721
$ yarn install
$ yarn compile
```

There are 3 contracts to be deployed:
- `ExamoleToken` (ERC721), L1
- `L2DepositedEERC721`, L2
- `OVM_L1ERC721Gateway`, L1

> `OVM_L1ERC721Gateway` is depoyed on L1 only. As its name suggests, it works as a "Gateway" which provides `deposit` and `withdraw` functions. User needs to use a gateway to move funds.

> At the time of writing, ERC721 gateway contract hasn't been implemented by the Optimism team. The contracts used in this example are from this [pull requrest](https://github.com/ethereum-optimism/contracts/pull/325) proposed by [@azf20](https://github.com/azf20).

Next, deploy these contracts by the script:

```bash
$ node ./deploy.js
Deploying L1 ERC721...
L1 ERC721 Contract Address:  0xFD471836031dc5108809D173A067e8486B9047A3
Deploying L2 ERC721...
L2 ERC721 Contract Address:  0x09635F643e140090A9A8Dcd712eD6285858ceBef
Deploying L1 ERC721 Gateway...
L1 ERC721 Gateway Contract Address:  0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc
Initializing L2 ERC721...
```

## ERC721 Mint, Deposit, Transfer and Withdrawal

### Mint ERC721 (L1)

In the begining, none of the accounts has any ERC721 token:

| L1/L2 | Account | IDs of Owned Token |
| - | - | - |
| L1 | Deployer | - |
| L1 | User | - |
| L2 | Deployer | - |
| L2 | User | - |

Next, We will mint 2 tokens to get started. Let's enter hardhat ETH (L1) console:

```bash
$ npx hardhat console --network eth
Welcome to Node.js v16.1.0.
Type ".help" for more information.
> 
```

Initialize deployer and user:

```javascript
// In Hardhat ETH Console

> let accounts = await ethers.getSigners()
> let deployer = accounts[0]
> let user = accounts[1]
```

Instantiate `ExampleToken` (ERC721) and `OVM_L1ERC721Gateway` contracts. Their contract addresses are in the outputs of the deploy script:

```javascript
// In Hardhat ETH Console

> let ERC721_abi = await artifacts.readArtifact("ExampleToken").then(c => c.abi)
> let ERC721 = new ethers.Contract("0xFD471836031dc5108809D173A067e8486B9047A3", ERC721_abi)
> let Gateway_abi = await artifacts.readArtifact("OVM_L1ERC721Gateway").then(c => c.abi)
> let Gateway = new ethers.Contract("0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc", Gateway_abi)
```

Use deployer to mint 2 tokens:

```javascript
// In Hardhat ETH Console

> await ERC721.connect(deployer).mintToken(deployer.address, "foo")
{
  hash: "...",
  ...
}
> await ERC721.connect(deployer).mintToken(deployer.address, "bar")
{
  hash: "...",
  ...
}
```

> Only the owner of the ExampleToken contract can mint.

Confirm the balance of the owner of tokens:

```javascript
> await ERC721.connect(deployer).balanceOf(deployer.address)
BigNumber { _hex: '0x02', _isBigNumber: true } // 2
> await ERC721.connect(deployer).ownerOf(1)
'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // deployer
> await ERC721.connect(deployer).ownerOf(2)
'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // deployer
```

### Deposit ERC721 （L1 => L2）

Here are the current balances:

| L1/L2 | Account | IDs of Owned Token |
| - | - | - |
| L1 | Deployer | 1, 2 |
| L1 | User | - |
| L2 | Deployer | - |
| L2 | User | - |

Next, approve `OVM_L1ERC721Gateway` to transfer the token which has `2` as TokenID:

```javascript
// In Hardhat ETH Console

> await ERC721.connect(deployer).approve("0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc", 2)
{
  hash: "...",
  ...
}
```

Call `deposit` at `OVM_L1ERC721Gateway` contract to deposit this token:

```javascript
// In Hardhat ETH Console

> await Gateway.connect(deployer).deposit(2)
{
  hash: "...",
  ...
}
```

Confirm if the deposit is successful from Optimistic Ethereum (L2) console:

```bash
$ npx hardhat console --network optimism
Welcome to Node.js v16.1.0.
Type ".help" for more information.
> 
```

Initialize Deployer and User:

```javascript
// In Hardhat Optimism Console

> let accounts = await ethers.getSigners()
> let deployer = accounts[0]
> let user = accounts[1]
```

Instantiate `L2DepositedERC721` contract. Its contract address is in the outputs of the deploy script:

```javascript
// In Hardhat Optimism Console

> let L2ERC721_abi = await artifacts.readArtifact("OVM_L2DepositedERC721").then(c => c.abi)
> let L2DepositedERC721 = new ethers.Contract("0x09635F643e140090A9A8Dcd712eD6285858ceBef", L2ERC721_abi)
```

Confirm if the deposit is successful:

```javascript
// In Hardhat Optimism Console

> await L2DepositedERC721.connect(deployer).balanceOf(deployer.address)
BigNumber { _hex: '0x01', _isBigNumber: true } // 1
> await L2DepositedERC721.connect(deployer).ownerOf(2)
'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // deployer
```

### Transfer ERC721 （L2 <=> L2）

Here are the current balances:

| L1/L2 | Account | IDs of Owned Token |
| - | - | - |
| L1 | Deployer | 1 |
| L1 | User | - |
| L2 | Deployer | 2 |
| L2 | User | - |

Next, let's transfer some funds from deployer to user:

```javascript
// In Hardhat Optimism Console

> await L2DepositedERC721.connect(user).balanceOf(user.address)
BigNumber { _hex: '0x00', _isBigNumber: true } // 0
> await L2DepositedERC721.connect(deployer).transferFrom(depoyer.address, user.address, 2)
{
  hash: "..."
  ...
}
> await L2DepositedERC721.connect(user).balanceOf(user.address)
BigNumber { _hex: '0x01', _isBigNumber: true } // 1
> await L2DepositedERC721.connect(user).ownerOf(2)
'0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // user
```

### Withdraw ERC721 （L2 => L1）

Here are the current balances:

| L1/L2 | Account | IDs of Owned Token |
| - | - | - |
| L1 | Deployer | 1 |
| L1 | User | - |
| L2 | Deployer | - |
| L2 | User | 2 |

Next, let's withdraw the funds via account user. Call `withdraw` at `L2DepositedERC721` contract:

```javascript
// In Hardhat Optimism Console

> await L2DepositedERC721.connect(user).withdraw(2)
{
  hash: "..."
  ...
}
> await L2DepositedERC721.connect(user).balanceOf(user.address)
BigNumber { _hex: '0x00', _isBigNumber: true }
```

Finally, let's confirm if the withdrawal is successful on L1:

```javascript
// In Hardhat ETH Console

> await ERC721.connect(user).balanceOf(user.address)
BigNumber { _hex: '0x01', _isBigNumber: true } // 1
> await ERC721.connect(deployer).balanceOf(deployer.address)
BigNumber { _hex: '0x01', _isBigNumber: true } // 1
> await ERC721.connect(user).ownerOf(2)
'0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // user
```

> Since the `FRAUD_PROOF_WINDOW_SECONDS` is set to be `0` second, you don't need to wait too long before the fund is withdrawn back to L1.

After all the operations, here are the final balances:

| L1/L2 | Account | IDs of Owned Token |
| - | - | - |
| L1 | Deployer | 1 |
| L1 | User | 2 |
| L2 | Deployer | - |
| L2 | User | - |

## Reference

- [OVM Deep Dive](https://medium.com/ethereum-optimism/ovm-deep-dive-a300d1085f52)
- [(Almost) Everything you need to know about Optimistic Rollup](https://research.paradigm.xyz/rollups)
- [How does Optimism's Rollup really work?](https://research.paradigm.xyz/optimism)
- [Optimistic Rollup Official Documentation](https://community.optimism.io/docs/)
- [Ethers Documentation (v5)](https://docs.ethers.io/v5/)
- [Optimistic Rollup Example: ERC20(Github)](https://github.com/ccniuj/optimistic-rollup-example-erc20)
- [Optimism (Github)](https://github.com/ethereum-optimism/optimism)
- [optimism-tutorial (Github)](https://github.com/ethereum-optimism/optimism-tutorial)
- [l1-l2-deposit-withdrawal (Github)](https://github.com/ethereum-optimism/l1-l2-deposit-withdrawal)
- [Proof-of-concept ERC721 Bridge Implementation (Github)](https://github.com/ethereum-optimism/contracts/pull/325)
