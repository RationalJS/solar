import {createReadStream} from 'fs'
import collect from '../src/lib/collect'
import Router from '../src/router'
import * as Server from '../src/http-server'
import request from 'supertest'
var o = require('ospec')

o.spec('http-server', function () {

  o('catchall request', async function () {
    var router = new Router()
    router.add(async (r) => r.status(200).send('hi'))

    var server = Server.createServer(router)
    await request(server)
      .get('/aoeuaoe-anything')
      .expect(res => {
        o(res.status).equals(200)
        o(res.text).equals('hi')
        o(res.header['content-type']).equals('text/plain')
      })

    await request(server)
      .post('/mmm')
      .expect(res => {
        o(res.status).equals(200)
        o(res.text).equals('hi')
        o(res.header['content-type']).equals('text/plain')
      })
  })

  o('post echo', async function () {
    var router = new Router()
    router.add(async (r) =>
      r.req.url === '/text'
      ? r.send(await r.body('text'))
      : r.req.url === '/json'
      ? r.send(await r.body('json'))
      : r.fail()
    )

    var server = Server.createServer(router)
    await request(server)
      .post('/text')
      .send('cool stuff')
      .expect(res => {
        o(res.status).equals(200)
        o(res.text).equals('cool stuff')
      })

    await request(server)
      .post('/json')
      .send({ x: 10 })
      .expect(res => {
        o(res.status).equals(200)
        o(res.header['content-type']).equals('application/json')
        o(res.text).equals('{"x":10}')
      })
  })

  o('post body type coercion', async function () {
    var router = new Router()
    router.add(async (r) => {
      var body = await r.body<{ abc: number }>('json')
      var val = String(body.abc)
      // val = body.xyz // Type error
      return r.send(val)
    })

    var server = Server.createServer(router)
    await request(server)
      .post('/coerce')
      .send({ abc: 123 })
      .expect(res => {
        o(res.status).equals(200)
        o(res.text).equals('123')
      })
  })

  o('json parse errors', async function () {
    var router = new Router()
    router.add(async (r) => {
      return r.send(await r.body('json'))
    })

    var server = Server.createServer(router)
    await request(server)
      .post('/err')
      .send('baad')
      .expect(res => {
        o(res.status).equals(400)
        o(res.header['content-type']).equals('application/json')
        o(res.text).equals('{"statusCode":400,"error":"Bad Request","message":"body_parse_error"}')
      })
  })

  o('headers get/set', async function () {
    var router = new Router()
    router.add(async (r) => {
      let r2;
      // Only create new responses to test headers
      switch(r.req.url) {
        case '/1': r2 = r.header('x','10').status(999); break
        case '/2': r2 = r.status(999).header('x','20'); break
        case '/3':
          r2 = r.status(999).send('nope').header('x','30'); break
        default:
          throw new Error('shouldnt happen')
      }

      return r.status(200).send( r2.header('x') )
    })

    var server = Server.createServer(router)
    await request(server).get('/1').expect(res => {
      o(res.status).equals(200)
      o(res.text).equals('10')
    })
    await request(server).get('/2').expect(res => {
      o(res.status).equals(200)
      o(res.text).equals('20')
    })
    await request(server).get('/3').expect(res => {
      o(res.status).equals(200)
      o(res.text).equals('30')
    })
  })

  o('headers immutability', async function () {
    var router = new Router()
    router.add(async (r) => {
      r.header('x', '10')

      return r.header('x', '20').send('imm')
    })

    var server = Server.createServer(router)
    await request(server).get('/123132').expect(res => {
      o(res.status).equals(200)
      o(res.text).equals('imm')
      o(res.header['x']).equals('20')
    })
  })

  o('stream response', async function () {
    var router = new Router()
    router.add(async (rt) =>
      rt.status(200)
        .send( createReadStream(`${__dirname}/fixtures/index.css`) )
    )

    var server = Server.createServer(router)
    await request(server)
      .get('/streammm')
      .parse((res, done) => {
        collect(res, 'utf8').then(data => done(null,data), err => done(err,null))
      })
      .expect(res => {
        o(res.body).equals('body { color: blue; }\n')
      })
  })

  o('match failures', async function () {
    var router = new Router()
    router.add(async (r) => r.fail())
    router.add(async (r) => r.status(300).fail())
    router.add(async (r) => r.status(200).send('hi'))

    var server = Server.createServer(router)
    await request(server)
      .get('/aoeuaoe-anything')
      .expect(res => {
        o(res.status).equals(200)
        o(res.text).equals('hi')
        o(res.header['content-type']).equals('text/plain')
      })
  })
})
