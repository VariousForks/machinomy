/**
 * Start this file by
 *
 * node server.js
 *
 * The script runs 3 core endpoints.
 * http://localhost:3000/content provides an example of the paid content.
 * http://localhost:3001/machinomy accepts payment.
 * http://localhost:3001/verify/:token verifies token that /machinomy generates.
 *
 * The main use case is to buy content:
 *
 * $ machinomy buy http://localhost:3000/content
 *
 * The command shows the bought content on console.
 *
 * Then you can see channels:
 *
 * $ machinomy channels
 *
 * And if you wants to close channel, call `/claim` endpoint via curl:
 *
 * $ curl -X POST http://localhost:3001/claim/:channeId
 */

import * as express from 'express'
import Web3 = require('web3')
import Machinomy from '../index'
import Payment from '../lib/Payment'
import * as bodyParser from 'body-parser'
let fetch = require('whatwg-fetch').fetch

/**
 * Account that receives payments.
 */
let receiver = '0xebeab176c2ca2ae72f11abb1cecad5df6ccb8dfe'

/**
 * Geth must be run on local machine, or use another web3 provider.
 */
let provider = new Web3.providers.HttpProvider('http://localhost:8545')
let web3 = new Web3(provider)

/**
 * Create machinomy instance that provides API for accepting payments.
 */
let machinomy = new Machinomy(receiver, web3, { engine: 'nedb' })

let hub = express()
hub.use(bodyParser.json())
hub.use(bodyParser.urlencoded({ extended: false }))

/**
 * Recieve an off-chain payment issued by `machinomy buy` command.
 */
hub.post('/machinomy', async (req: express.Request, res: express.Response, next: Function) => {
  let payment = new Payment(req.body)
  let token = await machinomy.acceptPayment(payment)
  res.status(202).header('Paywall-Token', token).send('Accepted').end()
})

/**
 * Verify the token that `/machinomy` generates.
 */
hub.get('/verify/:token', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token: string = req.params.token
  let isOk = false
  isOk = await machinomy.verifyToken(token)
  if (isOk) {
    res.status(200).send({ status: 'ok' })
  } else {
    res.status(500).send({ status: 'token is invalid' })
  }
})

hub.get('/claim/:channelid', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    let channelId = req.params.channelid
    await machinomy.close(channelId)
    res.status(200).send('Claimed')
  } catch (error) {
    res.status(404).send('No channel found')
    console.log(error)
  }
})

let port = 3001
hub.listen(port, function () {
  console.log('HUB is ready on port ' + port)
})

let app = express()
let paywallHeaders = () => {
  let headers: { [index: string]: string } = {}
  headers['Paywall-Version'] = '0.0.3'
  headers['Paywall-Price'] = '0.1'
  headers['Paywall-Address'] = receiver
  headers['Paywall-Gateway'] = 'http://localhost:3001/machinomy'
  return headers
}

/**
 * Example of serving a paid content. You can buy it with `machinomy buy http://localhost:3000/content` command.
 */
app.get('/content', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let reqUrl = 'http://localhost:3001/verify'
  let content = req.get('authorization')
  if (content) {
    let token = content.split(' ')[1]
    let response = await fetch(reqUrl + '/' + token)
    let json = await response.json()
    let status = json.status
    if (status === 'ok') {
      res.send('Thank you for your purchase')
    } else {
      res.status(402).set(paywallHeaders()).send('Content is not avaible')
    }
  } else {
    res.status(402).set(paywallHeaders()).send('Content is not avaible')
  }
})

let portApp = 3000
app.listen(portApp, function () {
  console.log('Content proveder is ready on ' + portApp)
})
