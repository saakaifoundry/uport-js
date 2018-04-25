import Credentials from '../Credentials'
import { SimpleSigner, createJWT, verifyJWT, decodeJWT } from 'did-jwt'
import nacl from 'tweetnacl'
import naclutil from 'tweetnacl-util'
import nock from 'nock'
import MockDate from 'mockdate'
MockDate.set(1485321133 * 1000)

const privateKey = '74894f8853f90e6e3d6dfdd343eb0eb70cca06e552ed8af80adadcc573b35da3'
const signer = SimpleSigner(privateKey)
const address = '0xbc3ae59bc76f894822622cdef7a2018dbe353840'
const did = `did:ethr:${address}`
const mnid = '2nQtiQG6Cgm1GYTBaaKAgr76uY7iSexUkqX'

const uport = new Credentials({privateKey, did})
const uport2 = new Credentials({})


describe('configuration', () => {

  describe('sets did', () => {
    describe('`did` configured', () => {
      expect(new Credentials({did}).did).toEqual(did)
    })
    describe('ethereum `address` configured', () => {
      expect(new Credentials({address}).did).toEqual(did)
    })

    describe('mnid `address` configured', () => {
      expect(new Credentials({address: mnid}).did).toEqual(`did:uport:${mnid}`)
    })

  })
  // describe('registry', () => {
  //   it('has a default registry that looks up profile', () => {
  //     return new Credentials().settings.registry('0x3b2631d8e15b145fd2bf99fc5f98346aecdc394c').then(profile =>
  //       expect(profile.publicKey).toEqual('0x0482780d59037778ea03c7d5169dd7cf47a835cb6d57a606b4e6cf98000a28d20d6d6bfae223cc76fd2f63d8a382a1c054788c4fafb1062ee89e718b96e0896d40')
  //     )
  //   })
  
  //   it('has ability to lookup profile', () => {
  //     return new Credentials().lookup('0x3b2631d8e15b145fd2bf99fc5f98346aecdc394c').then(profile =>
  //       expect(profile.publicKey).toEqual('0x0482780d59037778ea03c7d5169dd7cf47a835cb6d57a606b4e6cf98000a28d20d6d6bfae223cc76fd2f63d8a382a1c054788c4fafb1062ee89e718b96e0896d40')
  //     )
  //   })
  // })
  
  describe('configNetworks', () => {
    it('should accept a valid network setting', () => {
      const networks = {'0x94365e3b': { rpcUrl: 'https://private.chain/rpc', registry: '0x3b2631d8e15b145fd2bf99fc5f98346aecdc394c' }}
      const credentials =  new Credentials({networks})
      // What is the opposite of toThrow()??
      expect(true).toBeTruthy()
    })
  
    it('should require a registry address', () => {
      const networks = {'0x94365e3b': { rpcUrl: 'https://private.chain/rpc' }}
      expect(() => new Credentials({networks})).toThrowErrorMatchingSnapshot()
    })
  
    it('should require a rpcUrl', () => {
      const networks = {'0x94365e3b': { registry: '0x3b2631d8e15b145fd2bf99fc5f98346aecdc394c' }}
      expect(() => new Credentials({networks})).toThrowErrorMatchingSnapshot()
    })
  
    it('if networks key is passed in it must contain configuration object', () => {
      const networks = {'0x94365e3b': 'hey'}
      expect(() => new Credentials({networks})).toThrowErrorMatchingSnapshot()
    })
  })
})

describe('createRequest', () => {
  async function createAndVerify (params={}) {
    const jwt = await uport.createRequest(params)
    return await verifyJWT(jwt)
  }
  it('creates a valid JWT for a request', async () => {
    const response = await createAndVerify({requested: ['name', 'phone']})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT for a plain request for public details', async () => {
    const response = await createAndVerify()
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT requesting a specific network_id', async () => {
    const response = await createAndVerify({network_id: '0x4'})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT requesting a specific accountType', async () => {
    const response = await createAndVerify({accountType: 'devicekey'})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT requesting a bad accountType', async () => {
    const response = await createAndVerify({accountType: 'bad_account_type'})
    return expect(response).toMatchSnapshot()
  })

  it('ignores unsupported request parameters', async () => {
    const response = await createAndVerify({signing: true, sellSoul: true})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT for a request', async () => {
    const response = await createAndVerify({requested: ['name', 'phone']})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT for a request asking for verified credentials', async () => {
    const response = await createAndVerify({requested: ['name', 'phone'], verified: ['name']})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT for a request with callbackUrl', async () => {
    const response = await createAndVerify({requested: ['name', 'phone'], callbackUrl: 'https://myserver.com'})
    return expect(response).toMatchSnapshot()
  })

  it('has correct payload in JWT for a request for push notifications', async () => {
    const response = await createAndVerify({requested: ['name', 'phone'], notifications: true})
    return expect(response).toMatchSnapshot()
  })
})

describe('attest', () => {
  it('has correct payload in JWT for an attestation', () => {
    return uport.attest({sub: '0x112233', claim: {email: 'bingbangbung@email.com'}, exp: 1485321133 + 1}).then((jwt) => {
      return expect(verifyJWT(jwt)).toMatchSnapshot()
    })
  })
})

describe('receive', () => {
  function createShareResp (payload = {}) {
    return uport.createRequest({requested: ['name', 'phone']}).then((jwt) => {
      return createJWT({...payload, type: 'shareResp', req:jwt}, {issuer: did, signer, alg: 'ES256K-R'})
    })
  }

  function createShareRespMissingRequest (payload = {}) {
    return uport.createRequest({requested: ['name', 'phone']}).then((jwt) => {
      return createJWT({...payload, type: 'shareResp'}, {issuer: did, signer, alg: 'ES256K-R'})
    })
  }

  function createShareRespWithExpiredRequest (payload = {}) {
    return uport.createRequest({requested: ['name', 'phone'], exp: Date.now() - 1}).then((jwt) => {
      return createJWT({...payload, type: 'shareResp', req:jwt}, {issuer: did, signer, alg: 'ES256K-R'})
    })
  }

  function createShareRespWithVerifiedCredential (payload = {}, verifiedClaim = {sub: '0x112233', claim: {email: 'bingbangbung@email.com'}, exp: 1485321133 + 1}) {
    return uport.attest(verifiedClaim).then(jwt => {
      return createShareResp({...payload, verified: [jwt]})
    })
  }

  it('returns profile mixing public and private claims', async () => {
    const jwt = await createShareResp({own: {name: 'Davie', phone: '+15555551234'}})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile mixing public and private claims and verified credentials', async () => {
    const jwt = await createShareRespWithVerifiedCredential({own: {name: 'Davie', phone: '+15555551234'}})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile with only public claims', async () => {
    const jwt = await createShareResp()
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile with private chain network id claims', async () => {
    const jwt = await createShareResp({nad: '34wjsxwvduano7NFC8ujNJnFjbacgYeWA8m'})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile with device key claims', async () => {
    const jwt = await createShareResp({dad: '0xdeviceKey'})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })
  
  it('returns pushToken if available', async () => {
    const jwt = await createShareResp({capabilities: ['PUSHTOKEN']})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })
  
  it('handles response to expired request', async () => {
    const jwt = await createShareRespWithExpiredRequest()
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('handles response with missing challenge', async () => {
    const jwt = await createShareRespMissingRequest()
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

/////////////////////////////// no address in uport settings ///////////////////////////////

  it('returns profile mixing public and private claims', async () => {
    const jwt = await createShareResp({own: {name: 'Davie', phone: '+15555551234'}})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile mixing public and private claims and verified credentials', async () => {
    const jwt = await createShareRespWithVerifiedCredential({own: {name: 'Davie', phone: '+15555551234'}})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile with only public claims', async () => {
    const jwt = await createShareResp()
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns profile with private chain network id claims', async () => {
    const jwt = await createShareResp({nad: '34wjsxwvduano7NFC8ujNJnFjbacgYeWA8m'})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

  it('returns pushToken if available', async () => {
    const jwt = await createShareResp({capabilities: ['PUSHTOKEN']})
    const profile = uport.receive(jwt)
    expect(profile).toMatchSnapshot()
  })

/////////////////////////////// no address in uport settings///////////////////////////////
})

describe('push', () => {
  const PUTUTU_URL = 'https://pututu.uport.space' // TODO - change to .me
  const API_v1_PATH = '/api/v1/sns'
  const API_v2_PATH = '/api/v2/sns'
  const PUSHTOKEN = 'SECRETPUSHTOKEN'
  const payload = { url: 'me.uport:me', message: 'a friendly message' }
  const kp = nacl.box.keyPair()
  const pubEncKey = naclutil.encodeBase64(kp.publicKey)
  const secEncKey = kp.secretKey

  it('pushes url to pututu', () => {
    nock(PUTUTU_URL, {
      reqheaders: {
        'authorization': `Bearer ${PUSHTOKEN}`
      }
    })
    .post(API_v2_PATH, (body) => {
      let encObj = JSON.parse(body.message)
      const box = naclutil.decodeBase64(encObj.ciphertext)
      const nonce = naclutil.decodeBase64(encObj.nonce)
      const from = naclutil.decodeBase64(encObj.from)
      const decrypted = nacl.box.open(box, nonce, from, secEncKey)
      const result = JSON.parse(naclutil.encodeUTF8(decrypted))

      return result.url === payload.url && result.message === payload.message
    })
    .reply(200, { status: 'success', message: 'd0b2bd07-d49e-5ba1-9b05-ec23ac921930' })

    return uport.push(PUSHTOKEN, pubEncKey, payload).then(response => {
      return expect(response).toEqual({ status: 'success', message: 'd0b2bd07-d49e-5ba1-9b05-ec23ac921930' })
    })
  })

  it('handles missing token', () => {
    return uport.push(null, pubEncKey, payload).catch(error => expect(error.message).toEqual('Missing push notification token'))
  })

  it('handles missing pubEncKey', () => {
    nock(PUTUTU_URL, {
      reqheaders: {
        'authorization': `Bearer ${PUSHTOKEN}`
      }
    })
    .post(API_v1_PATH, (body) => {
      return body.message === payload.message && body.url === payload.url
    })
    .reply(200, { status: 'success', message: 'd0b2bd07-d49e-5ba1-9b05-ec23ac921930' })

    console.error = jest.fn(msg => {
      expect(msg).toEqual('WARNING: Calling push without a public encryption key is deprecated')
    })
    return uport.push(PUSHTOKEN, payload).then(response => {
      return expect(response).toEqual({ status: 'success', message: 'd0b2bd07-d49e-5ba1-9b05-ec23ac921930' })
    })
  })

  it('handles missing payload', () => {
    return uport.push(PUSHTOKEN, pubEncKey, {}).catch(error => expect(error.message).toEqual('Missing payload url for sending to users device'))
  })

  it('handles invalid token', () => {
    nock(PUTUTU_URL, {
      reqheaders: {
        'authorization': `Bearer ${PUSHTOKEN}`
      }
    })
    .post(API_v2_PATH, () => true)
    .reply(403, 'Not allowed')

    return uport.push(PUSHTOKEN, pubEncKey, payload).catch(error => expect(error.message).toEqual('Error sending push notification to user: Invalid Token'))
  })

  it('handles random error', () => {
    nock(PUTUTU_URL, {
      reqheaders: {
        'authorization': `Bearer ${PUSHTOKEN}`
      }
    })
    .post(API_v2_PATH, () => true)
    .reply(500, 'Server Error')

    return uport.push(PUSHTOKEN, pubEncKey, payload).catch(error => expect(error.message).toEqual('Error sending push notification to user: 500 Server Error'))
  })
})
