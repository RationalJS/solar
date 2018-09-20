import Router from '../src/router'
import {create} from '../src/plain-server'
var o = require('ospec')

o.spec('router', function () {

  o('get', async function () {
    var router = new Router()
    router
      .get('/abc')
      .end(async r => r.send('cool'))

    var result1 = await create(router).request('GET', '/abc')
    o(result1.status).equals(200)
    o(result1.body).equals('cool')

    var result2 = await create(router).request('GET', '/abc/')
    o(result2.status).equals(404)
    o(result2.body).deepEquals({ message: 'no_such_route' })

    var result3 = await create(router).request('GET', '/xyz')
    o(result3.status).equals(404)
    o(result3.body).deepEquals({ message: 'no_such_route' })
  })

  o('get shorthand', async function () {
    var router = new Router()
    router
      .get('/x').end(async r => r.send('10'))
      .get('/y').end(async r => r.send('20'))

    var result1 = await create(router).request('GET', '/x')
    o(result1.body).equals('10')

    var result2 = await create(router).request('GET', '/y')
    o(result2.body).equals('20')
  })


  o('url parameters', async function () {
    var router = new Router()
    router
      .get('/users/:id', ([userId]) => ({ userId }))
      .end(async r => r.send(r.ctx.userId))

    var result1 = await create(router).request('GET', '/users/10')
    o(result1.status).equals(200)
    o(result1.body).equals('10')

    var result2 = await create(router).request('GET', '/users')
    o(result2.status).equals(404)
    o(result2.body).deepEquals({ message: 'no_such_route' })
  })

  o('use middleware (fail branch)', async function () {
    var router = new Router()
      .use(async r => r.req.url[1] === 'x' ? r : r.fail())
      .get('/x1').end(async r => r.send('10'))
      .get('/x2').end(async r => r.send('20'))
      .get('/yy').end(async r => r.send('30'))

    var result1 = await create(router).request('GET', '/x1')
    o(result1.body).equals('10')

    var result2 = await create(router).request('GET', '/x2')
    o(result2.body).equals('20')

    // Even though this is defined as a valid route
    // it should fail due to the middleware
    var result3 = await create(router).request('GET', '/yy')
    o(result3.status).equals(404)
  })

  o.only('use middleware (extend ctx)', async function () {
    var router = new Router()
      .get('/x').end(async r => r.send('10'))
      //
      // Extend from middleware
      //
      .use(async r => r.extend({ aaa: 99 }))
      .get('/y').end(async r => r.send(''+r.ctx.aaa))
      //
      // Extend from url param parser
      //
      .get('/z/:num', ([bbb]) => ({ bbb }))
      .end(async r => r.send(r.ctx.aaa + ',' + r.ctx.bbb))

    var result1 = await create(router).request('GET', '/x')
    o(result1.body).equals('10')

    var result2 = await create(router).request('GET', '/y')
    o(result2.body).equals('99')

    var result2 = await create(router).request('GET', '/z/55')
    o(result2.body).equals('99,55')
  })
})
