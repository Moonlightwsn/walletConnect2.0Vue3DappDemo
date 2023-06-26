<script setup lang="ts">
import { ref, onMounted, watchEffect } from "vue"
import { utils } from "ethers"
import Web3 from "web3"
import { Web3Modal } from "@web3modal/standalone"
import * as encoding from "@walletconnect/encoding"
import UniversalProvider from "@walletconnect/universal-provider"
import Client from "@walletconnect/sign-client"
import { apiGetChainNamespace, ChainsMap } from "caip-api"

import { SessionTypes } from "@walletconnect/types"

import {
  DEFAULT_PROJECT_ID,
  DEFAULT_LOGGER,
  DEFAULT_RELAY_URL,
  MAINNET_CHAAIN_ID,
} from "./constants"

interface IFormattedRpcResponse {
  method: string
  address: string
  valid: boolean
  result: string
}

const account = ref<any>()

const client = ref<Client>()
const provider = ref<UniversalProvider>()
const web3Provider = ref<Web3>()
const web3Modal = ref<Web3Modal>()

const session = ref<SessionTypes.Struct>()

const chains = ref<ChainsMap>()

onMounted(() => {
  getEip155ChianNamespace()
  createClient()
})

watchEffect(() => {
  if (provider.value && web3Modal.value) {
    subscribeToProviderEvents(provider.value)
  }
})

const createClient = async () => {
  if (!client.value) {
    const _provider = await UniversalProvider.init({
      projectId: DEFAULT_PROJECT_ID,
      logger: DEFAULT_LOGGER,
      relayUrl: DEFAULT_RELAY_URL,
    })

    const _web3Modal = new Web3Modal({
      projectId: DEFAULT_PROJECT_ID || "",
      walletConnectVersion: 2,
    })
    provider.value = _provider
    // @ts-ignore
    client.value = _provider.client
    web3Modal.value = _web3Modal
  }
}

const getEip155ChianNamespace = async () => {
  const namespace = "eip155"
  let _chains: ChainsMap | undefined
  try {
    _chains = await apiGetChainNamespace(namespace)
  } catch (e) {
    // ignore error
  }
  if (typeof _chains !== "undefined") {
    chains.value = _chains
  }
}

const createWeb3Provider = (_provider: UniversalProvider) => {
  const _web3Provider = new Web3(_provider)
  web3Provider.value = _web3Provider
}

const connect = async () => {
  if (!provider.value) {
    throw new ReferenceError("WalletConnect Client is not initialized.")
  }

  const chainId = MAINNET_CHAAIN_ID
  console.log("Enabling EthereumProvider for chainId: ", chainId)

  if (!chains.value) {
    throw new ReferenceError("Chain NameSpace is undefined.")
  }

  const customRpcs = Object.keys(chains.value).reduce(
    (rpcs: Record<string, string>, chainId) => {
      rpcs[chainId] = chains.value![chainId].rpc[0]
      return rpcs
    },
    {}
  )

  const _session = await provider.value.connect({
    namespaces: {
      eip155: {
        methods: [
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_sign",
          "personal_sign",
          "eth_signTypedData",
        ],
        chains: [`eip155:${chainId}`],
        events: ["chainChanged", "accountsChanged"],
        rpcMap: customRpcs,
      },
    },
  })
  session.value = _session

  createWeb3Provider(provider.value)
  const _accounts = await provider.value.enable()
  console.log("_accounts", _accounts)
  account.value = _accounts

  web3Modal.value?.closeModal()
}

const disconnect = async () => {
  if (typeof provider.value === "undefined") {
    throw new Error("ethereumProvider is not initialized")
  }
  await provider.value.disconnect()
  session.value = undefined
  account.value = undefined
}

const subscribeToProviderEvents = async (_client: UniversalProvider) => {
  if (typeof _client === "undefined") {
    throw new Error("WalletConnect is not initialized")
  }

  _client.on("display_uri", async (uri: string) => {
    console.log("EVENT", "QR Code Modal open")
    web3Modal.value?.openModal({ uri })
  })

  // Subscribe to session ping
  _client.on("session_ping", ({ id, topic }: { id: number; topic: string }) => {
    console.log("EVENT", "session_ping")
    console.log(id, topic)
  })

  // Subscribe to session event
  _client.on(
    "session_event",
    ({ event, chainId }: { event: any; chainId: string }) => {
      console.log("EVENT", "session_event")
      console.log(event, chainId)
    }
  )

  // Subscribe to session update
  _client.on(
    "session_update",
    ({
      topic,
      session: _session,
    }: {
      topic: string
      session: SessionTypes.Struct
    }) => {
      console.log("EVENT", "session_updated")
      console.log("TOPIC", topic)
      session.value = _session
    }
  )

  // Subscribe to session delete
  _client.on(
    "session_delete",
    ({ id, topic }: { id: number; topic: string }) => {
      console.log("EVENT", "session_deleted")
      console.log(id, topic)
      session.value = undefined
      account.value = undefined
    }
  )
}

const verifyEip155MessageSignature = (
  message: string,
  signature: string,
  address: string
) =>
  utils.verifyMessage(message, signature).toLowerCase() ===
  address.toLowerCase()

const testSignMessage: () => Promise<IFormattedRpcResponse> = async () => {
  if (!web3Provider.value) {
    throw new Error("web3Provider not connected")
  }
  const msg = "hello world"
  const hexMsg = encoding.utf8ToHex(msg, true)
  const [address] = await web3Provider.value.eth.getAccounts()
  const signature = await web3Provider.value.eth.personal.sign(
    hexMsg,
    address,
    ""
  )
  const valid = verifyEip155MessageSignature(msg, signature, address)
  const result = {
    method: "personal_sign",
    address,
    valid,
    result: signature,
  }
  console.log("testSignMessage", result)
  return result
}

const testSendTransaction: () => Promise<IFormattedRpcResponse> = async () => {
  if (!web3Provider.value) {
    throw new Error("web3Provider not connected")
  }

  const [address] =
    account.value ?? (await web3Provider.value.eth.getAccounts())

  const tx = {
    from: address,
    to: address,
    gasPrice: "20000000000",
    value: "0",
  }

  const { transactionHash } = await web3Provider.value.eth.sendTransaction(tx)

  const result = {
    method: "eth_sendTransaction",
    address,
    valid: true,
    result: transactionHash,
  }
  console.log("testSendTransaction", result)
  return result
}
</script>
<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <view>
    <button v-if="!account" @click="connect">Ethereum</button>
    <block v-else>
      <button @click="testSignMessage">Sign Message</button>
      <button @click="testSendTransaction">Send Transaction</button>
      <button @click="disconnect">Disconnect</button>
    </block>
  </view>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
