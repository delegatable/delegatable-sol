import { HardhatUserConfig } from "hardhat/config";
import { HardhatNetworkAccountUserConfig } from "hardhat/types";

// Accounts
const TESTNET_PK_DEPLOYER = process.env.TESTNET_PK_DEPLOYER || "";
const MAINNET_PK_DEPLOYER = process.env.MAINNET_PK_DEPLOYER || "";

// Json RPC Endpoints
const ARCHIVE_NODE_RPC_URL = process.env.ARCHIVE_NODE_RPC_URL;
const ETHEREUM_MAINNET_RPC_URL = process.env.ETHEREUM_MAINNET_RPC_URL;
const ETHEREUM_GOERLI_RPC_URL = process.env.ETHEREUM_GOERLI_RPC_URL;
const POLYGON_MAINNET_RPC_URL = process.env.POLYGON_MAINNET_RPC_URL;
const POLYGON_TESTNET_RPC_URL = process.env.POLYGON_TESTNET_RPC_URL;
const OPTIMISM_MAINNET_RPC_URL = process.env.OPTIMISM_MAINNET_RPC_URL;
const OPTIMISM_TESTNET_RPC_URL = process.env.OPTIMISM_TESTNET_RPC_URL;

// Forking
const FORK_ENABLED = process.env.FORK_ENABLED;
const FORK_BLOCK_NUMBER = process.env.FORK_BLOCK_NUMBER;

const MNEMONIC = "test test test test test test test test test test test junk";

/* ===================================================================================== */
/* Local                                                                                 */
/* ===================================================================================== */
const networks: HardhatUserConfig["networks"] = {
  coverage: {
    url: "http://127.0.0.1:8555",
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
  },
  localhost: {
    chainId: 1,
    url: "http://127.0.0.1:8545",
  },
};

/* ===================================================================================== */
/* Fork                                                                                  */
/* ===================================================================================== */
if (ARCHIVE_NODE_RPC_URL && FORK_ENABLED) {
  networks.hardhat = {
    chainId: 1,
    hardfork: "istanbul",
    accounts: { mnemonic: MNEMONIC },
    forking: {
      url: ARCHIVE_NODE_RPC_URL,
      blockNumber: Number(FORK_BLOCK_NUMBER || "0"),
    },
  };
} else {
  networks.hardhat = {
    allowUnlimitedContractSize: true,
    accounts: { mnemonic: MNEMONIC },
  };
}

/* ===================================================================================== */
/* External                                                                              */
/* ===================================================================================== */

if (MAINNET_PK_DEPLOYER && ETHEREUM_MAINNET_RPC_URL) {
  networks.mainnet = {
    url: ETHEREUM_MAINNET_RPC_URL,
    chainId: 1,
    accounts: [
      MAINNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

if (TESTNET_PK_DEPLOYER && ETHEREUM_GOERLI_RPC_URL) {
  networks.goerli = {
    url: ETHEREUM_GOERLI_RPC_URL,
    chainId: 5,
    accounts: [
      TESTNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

/**
 * Optimism
 * @mainnet: 10
 * @testnet: 42
 */
if (MAINNET_PK_DEPLOYER && OPTIMISM_MAINNET_RPC_URL) {
  networks.optimism = {
    url: OPTIMISM_MAINNET_RPC_URL,
    chainId: 10,
    accounts: [
      MAINNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

if (TESTNET_PK_DEPLOYER && OPTIMISM_TESTNET_RPC_URL) {
  networks.optimismTestnet = {
    url: OPTIMISM_TESTNET_RPC_URL,
    chainId: 420,
    accounts: [
      TESTNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

/**
 * Polygon
 * @mainnet: 137
 * @testnet: 80001
 */
if (MAINNET_PK_DEPLOYER && POLYGON_MAINNET_RPC_URL) {
  networks.polygon = {
    url: POLYGON_MAINNET_RPC_URL,
    chainId: 137,
    accounts: [
      MAINNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

if (TESTNET_PK_DEPLOYER && POLYGON_TESTNET_RPC_URL) {
  networks.polygonTestnet = {
    url: POLYGON_TESTNET_RPC_URL,
    chainId: 80001,
    accounts: [
      TESTNET_PK_DEPLOYER as unknown as HardhatNetworkAccountUserConfig,
    ],
  };
}

export default networks;
