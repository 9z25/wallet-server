// bch-js-examples require code from the main bch-js repo
const BCHJS = require('@psf/bch-js')
/*
  Create an HDNode wallet using bch-js. The mnemonic from this wallet
  will be used by later examples.
*/

// REST API servers.
const BCHN_MAINNET = 'https://bchn.fullstack.cash/v4/'




// Instantiate bch-js.
const bchjs = new BCHJS({
    restURL: BCHN_MAINNET
})

const fs = require('fs')

const lang = 'english' // Set the language of the wallet.

// These objects used for writing wallet information out to a file.
let outStr = ''
const outObj = {}


var express = require("express");

var cors = require('cors')


var app = express()
app.use(cors())
var app = express();
app.listen(3000, () => {
    console.log("Server running on port 3000");
});




let wallet = {};


app.get("/createWallet/:name", (req, res, next) => {


    async function createWallet() {
        try {
            // create 256 bit BIP39 mnemonic
            const mnemonic = bchjs.Mnemonic.generate(
                128,
                bchjs.Mnemonic.wordLists()[lang]
            )
            console.log('BIP44 $BCH Wallet')
            outStr += 'BIP44 $BCH Wallet\n'
            console.log(`128 bit ${lang} BIP39 Mnemonic: `, mnemonic)
            outStr += `\n128 bit ${lang} BIP32 Mnemonic:\n${mnemonic}\n\n`
            outObj.mnemonic = mnemonic

            // root seed buffer
            const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

            // master HDNode
            const masterHDNode = bchjs.HDNode.fromSeed(rootSeed)

            // HDNode of BIP44 account
            console.log('BIP44 Account: "m/44\'/145\'/0\'"')
            outStr += 'BIP44 Account: "m/44\'/145\'/0\'"\n'

            // Generate the first 10 seed addresses.
            for (let i = 0; i < 10; i++) {
                const childNode = masterHDNode.derivePath(`m/44'/145'/0'/0/${i}`)

                wallet[i] = bchjs.HDNode.toCashAddress(childNode)

                outStr += `m/44'/145'/0'/0/${i}: ${bchjs.HDNode.toCashAddress(
          childNode
        )}\n`

                // Save the first seed address for use in the .json output file.
                if (i === 0) {
                    outObj.cashAddress = bchjs.HDNode.toCashAddress(childNode)
                    outObj.legacyAddress = bchjs.HDNode.toLegacyAddress(childNode)
                    outObj.WIF = bchjs.HDNode.toWIF(childNode)
                }
            }

            // Write the extended wallet information into a text file.
            fs.writeFile('./wallets/'+req.params.name.toString()+'-info.txt', outStr, function(err) {
                if (err) return console.error(err)

                console.log('wallet-info.txt written successfully.')
            })

            // Write out the basic information into a json file for other example apps to use.
            fs.writeFile(req.params.name.toString() + '.json', JSON.stringify(outObj, null, 2), function(err) {
                if (err) return console.error(err)
                console.log('wallet.json written successfully.')
            })
        } catch (err) {
            console.error('Error in createWallet(): ', err)
        }

        return wallet;
    }
    createWallet().then((a) => {
        console.log(a)
        res.json(a);
    })

});




app.get("/pay/:recAddr/:amount/:name", (req, res, next) => {

    /*
  Send 1000 satoshis to RECV_ADDR.
*/

    // Replace the address below with the address you want to send the BCH to.
    let RECV_ADDR = req.params.recAddr.toString();

    // set satoshi amount to send
    var SATOSHIS_TO_SEND = parseInt(req.params.amount);

    console.log("TEST")
    console.log(RECV_ADDR);
    console.log(SATOSHIS_TO_SEND);



    // Open the wallet generated with create-wallet.
    try {
        var walletInfo = require('./wallets/'+req.params.name.toString()+'.json')
    } catch (err) {
        console.log(
            'Could not open wallet.json. Generate a wallet with create-wallet first.'
        )
        //process.exit(0)
    }


    const SEND_ADDR = walletInfo.cashAddress
    const SEND_MNEMONIC = walletInfo.mnemonic


    async function sendBch() {
        try {
            // Get the balance of the sending address.
            const balance = await getBCHBalance(SEND_ADDR, false)
            console.log(`balance: ${JSON.stringify(balance, null, 2)}`)
            console.log(`Balance of sending address ${SEND_ADDR} is ${balance} BCH.`)

            // Exit if the balance is zero.
            if (balance <= 0.0) {
                console.log('Balance of sending address is zero. Exiting.')
                //process.exit(0)
            }

            // If the user fails to specify a reciever address, just send the BCH back
            // to the origination address, so the example doesn't fail.
            if (RECV_ADDR === '') RECV_ADDR = SEND_ADDR

            // Convert to a legacy address (needed to build transactions).
            const SEND_ADDR_LEGACY = bchjs.Address.toLegacyAddress(SEND_ADDR)
            const RECV_ADDR_LEGACY = bchjs.Address.toLegacyAddress(RECV_ADDR)
            console.log(`Sender Legacy Address: ${SEND_ADDR_LEGACY}`)
            console.log(`Receiver Legacy Address: ${RECV_ADDR_LEGACY}`)

            // Get UTXOs held by the address.
            // https://developer.bitcoin.com/mastering-bitcoin-cash/4-transactions/
            const utxos = await bchjs.Electrumx.utxo(SEND_ADDR)
            // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`);

            if (utxos.utxos.length === 0) throw new Error('No UTXOs found.')

            // console.log(`u: ${JSON.stringify(u, null, 2)}`
            const utxo = await findBiggestUtxo(utxos.utxos)
            // console.log(`utxo: ${JSON.stringify(utxo, null, 2)}`);

            // instance of transaction builder
            const transactionBuilder = new bchjs.TransactionBuilder()

            // Essential variables of a transaction.
            const satoshisToSend = SATOSHIS_TO_SEND
            const originalAmount = utxo.value
            const vout = utxo.tx_pos
            const txid = utxo.tx_hash

            // add input with txid and index of vout
            transactionBuilder.addInput(txid, vout)

            // get byte count to calculate fee. paying 1.2 sat/byte
            const byteCount = bchjs.BitcoinCash.getByteCount({
                P2PKH: 1
            }, {
                P2PKH: 2
            })
            console.log(`Transaction byte count: ${byteCount}`)
            const satoshisPerByte = 1.2
            const txFee = Math.floor(satoshisPerByte * byteCount)
            console.log(`Transaction fee: ${txFee}`)

            // amount to send back to the sending address.
            // It's the original amount - 1 sat/byte for tx size
            const remainder = originalAmount - satoshisToSend - txFee

            if (remainder < 0) {
                throw new Error('Not enough BCH to complete transaction!')
            }

            // add output w/ address and amount to send
            transactionBuilder.addOutput(RECV_ADDR, satoshisToSend)
            transactionBuilder.addOutput(SEND_ADDR, remainder)

            // Generate a change address from a Mnemonic of a private key.
            const change = await changeAddrFromMnemonic(SEND_MNEMONIC)

            // Generate a keypair from the change address.
            const keyPair = bchjs.HDNode.toKeyPair(change)

            // Sign the transaction with the HD node.
            let redeemScript
            transactionBuilder.sign(
                0,
                keyPair,
                redeemScript,
                transactionBuilder.hashTypes.SIGHASH_ALL,
                originalAmount
            )

            // build tx
            const tx = transactionBuilder.build()
            // output rawhex
            const hex = tx.toHex()
            // console.log(`TX hex: ${hex}`);
            console.log(' ')

            // Broadcast transation to the network
            const txidStr = await bchjs.RawTransactions.sendRawTransaction([hex])
            // import from util.js file
            const util = require('./util/util.js')
            console.log(`Transaction ID: ${txidStr}`)
            console.log('Check the status of your transaction on this block explorer:')
            util.transactionStatus(txidStr, 'mainnet')
            var msg = {}
            msg.id = `Transaction ID: ${txidStr}`
            msg.line = 'Check the status of your transaction on this block explorer:'
            res.json(msg);
        } catch (err) {
            console.log('error: ', err)
        }
    }
    sendBch()

    // Generate a change address from a Mnemonic of a private key.
    async function changeAddrFromMnemonic(mnemonic) {
        // root seed buffer
        const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic)

        // master HDNode
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeed)

        // HDNode of BIP44 account
        const account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/145'/0'")

        // derive the first external change address HDNode which is going to spend utxo
        const change = bchjs.HDNode.derivePath(account, '0/0')

        return change
    }

    // Get the balance in BCH of a BCH address.
    async function getBCHBalance(addr, verbose) {
        try {
            const result = await bchjs.Electrumx.balance(addr)

            if (verbose) console.log(result)

            // The total balance is the sum of the confirmed and unconfirmed balances.
            const satBalance =
                Number(result.balance.confirmed) + Number(result.balance.unconfirmed)

            // Convert the satoshi balance to a BCH balance
            const bchBalance = bchjs.BitcoinCash.toBitcoinCash(satBalance)

            return bchBalance
        } catch (err) {
            console.error('Error in getBCHBalance: ', err)
            console.log(`addr: ${addr}`)
            throw err
        }
    }

    // Returns the utxo with the biggest balance from an array of utxos.
    async function findBiggestUtxo(utxos) {
        let largestAmount = 0
        let largestIndex = 0

        for (var i = 0; i < utxos.length; i++) {
            const thisUtxo = utxos[i]
            // console.log(`thisUTXO: ${JSON.stringify(thisUtxo, null, 2)}`);

            // Validate the UTXO data with the full node.
            const txout = await bchjs.Blockchain.getTxOut(
                thisUtxo.tx_hash,
                thisUtxo.tx_pos
            )
            if (txout === null) {
                // If the UTXO has already been spent, the full node will respond with null.
                console.log(
                    'Stale UTXO found. You may need to wait for the indexer to catch up.'
                )
                continue
            }

            if (thisUtxo.value > largestAmount) {
                largestAmount = thisUtxo.value
                largestIndex = i
            }
        }

        return utxos[largestIndex]
    }

});


app.get("/getWallet/:name", (req, res, next) => {

   // Open the wallet generated with create-wallet.
   try {
    var walletInfo = require('./wallets/'+req.params.name.toString()+'.json')
} catch (err) {
    console.log(
        'Could not open wallet.json. Generate a wallet with create-wallet first.'
    )
    //process.exit(0)
}

res.json(walletInfo);

});




app.get("/getBalance/:name", (req, res, next) => {




    // Open the wallet generated with create-wallet.
    try {
        var walletInfo = require('./wallets/'+req.params.name.toString()+'.json')
    } catch (err) {
        console.log(
            'Could not open wallet.json. Generate a wallet with create-wallet first.'
        )
        //process.exit(0)
    }

    // Get the balance of the wallet.
    async function getBalance() {
        try {
            // first get BCH balance
            const balance = await bchjs.Electrumx.balance(walletInfo.cashAddress)

            console.log('BCH Balance information:')
            console.log(JSON.stringify(balance, null, 2))
            res.json(balance);
        } catch (err) {
            console.error('Error in getBalance: ', err)
            throw err
        }
    }
    getBalance()



})



app.get("/getAddress/:name", (req, res, next) => {

    // Open the wallet generated with create-wallet.
    try {
        var walletInfo = require('./wallets/'+req.params.name.toString()+'.json')
    } catch (err) {
        console.log(
            'Could not open wallet.json. Generate a wallet with create-wallet first.'
        )
        //process.exit(0)
    }

    var msg = {}
    msg.address = walletInfo.cashAddress;

    res.json(msg)


});