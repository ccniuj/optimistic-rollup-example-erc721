const ethers = require('ethers')

// Set up some contract factories. You can ignore this stuff.
const factory = (name, type = '', ovm = false) => {
  const artifact = require(`./artifacts${ovm ? '-ovm' : ''}/contracts${type == '' ? '' : '/' + type}/${name}.sol/${name}.json`)
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
}
const factory__L1_ERC721 = factory('ExampleToken')
const factory__L2_ERC721 = factory('OVM_L2DepositedERC721', 'OVM', true)
const factory__L1_ERC721Gateway = factory('OVM_L1ERC721Gateway', 'OVM')

async function main() {
  // Set up our RPC provider connections.
  const l1RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:9545')
  const l2RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545')

  // Set up our wallets (using a default private key with 10k ETH allocated to it).
  // Need two wallets objects, one for interacting with L1 and one for interacting with L2.
  // Both will use the same private key.
  const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const l1Wallet = new ethers.Wallet(key, l1RpcProvider)
  const l2Wallet = new ethers.Wallet(key, l2RpcProvider)

  // L1 messenger address depends on the deployment, this is default for our local deployment.
  const l1MessengerAddress = '0x59b670e9fA9D0A427751Af201D676719a970857b'
  // L2 messenger address is always the same.
  const l2MessengerAddress = '0x4200000000000000000000000000000000000007'

  // Deploy an ERC721 token on L1.
  console.log('Deploying L1 ERC721...')
  const L1_ERC721 = await factory__L1_ERC721.connect(l1Wallet).deploy(
    'L1 ERC721 ExampleToken', //name
    'EPT' //symbol
  )
  await L1_ERC721.deployTransaction.wait()
  console.log("L1 ERC721 Contract Address: ", L1_ERC721.address)

  // Deploy the paired ERC721 token to L2.
  console.log('Deploying L2 ERC721...')
  const L2_ERC721 = await factory__L2_ERC721.connect(l2Wallet).deploy(
    l2MessengerAddress,
    'L2 ERC721 ExampleToken', //name
    'EPT', //symbol
    {
      gasPrice: 0
    }
  )
  await L2_ERC721.deployTransaction.wait()
  console.log("L2 ERC721 Contract Address: ", L2_ERC721.address)

  // Create a gateway that connects the two contracts.
  console.log('Deploying L1 ERC721 Gateway...')
  const L1_ERC721Gateway = await factory__L1_ERC721Gateway.connect(l1Wallet).deploy(
    L1_ERC721.address,
    L2_ERC721.address,
    l1MessengerAddress
  )
  await L1_ERC721Gateway.deployTransaction.wait()
  console.log("L1 ERC721 Gateway Contract Address: ", L1_ERC721Gateway.address)

  // Make the L2 ERC721 aware of the gateway contract.
  console.log('Initializing L2 ERC721...')
  const tx0 = await L2_ERC721.init(
    L1_ERC721Gateway.address,
    {
      gasPrice: 0
    }
  )
  await tx0.wait()
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
