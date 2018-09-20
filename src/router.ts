import {t,Middleware,ResFresh,ResFull,MatchFail,make} from './route'
import pathToRegexp from 'path-to-regexp'

const noopParser = (_params: string[]) => ({})
type ArgParser<T> = (params: string[]) => T


export default class Router<Ctx={},Res=ResFresh> {
  readonly _routes: t[]
  private _middleware: Middleware<{},ResFresh,Ctx,Res>
  constructor(middleware: Middleware<{},ResFresh,Ctx,Res> = async r => r) {
    this._routes = []
    this._middleware = middleware
  }

  add(handler: Middleware<Ctx,Res,any,ResFull>) {
    this._routes.push(make(async r => {
      var r2 = await this._middleware(r)
      if (r2 instanceof MatchFail) return r2
      return handler(r2)
    }))
  }

  use<C2,R2>(handler: Middleware<Ctx,Res,C2,R2>) {
    return new Router(async r => {
      var r2 = await this._middleware(r)
      if (r2 instanceof MatchFail) return r2
      return handler(r2)
    })
  }

  method<T>(type: string, path: string, parser: ArgParser<T>): RouteBuilder<Ctx,Res,Ctx & T,Res> {
    if (path[0] !== '/') path = '/' + path

    type = type.toUpperCase()

    var re = pathToRegexp(path, undefined, { strict: true })

    return new RouteBuilder<Ctx,Res,Ctx & T,Res>(
      this,
      async r => {
        if (r.req.method !== type) return r.fail()

        var match = re.exec(r.req.url)
        if (! match) return r.fail()

        var ctx = parser(match.slice(1))
        var r2 = r.extend(ctx)
        ;(r2 as any)._struct = { ...(r2 as any)._struct, urlMatched: match[0] }
        return r2
      }
    )
  }

  get(path: string): RouteBuilder<Ctx,Res,Ctx,Res>;
  get<T>(path: string, parser?: ArgParser<T>): RouteBuilder<Ctx,Res,Ctx & T,Res>;
  get<T>(path: string, parser?: ArgParser<T>) {
    return this.method('GET', path, parser || noopParser)
  }
}

class RouteBuilder<Ctx1,Res1,Ctx2,Res2> {
  private parent: Router<Ctx1,Res1>
  private middleware: Middleware<Ctx1,Res1,Ctx2,Res2>

  constructor(parent: Router<Ctx1,Res1>, middleware: Middleware<Ctx1,Res1,Ctx2,Res2>) {
    this.parent = parent
    this.middleware = middleware
  }

  add(this: RouteBuilder<Ctx1,Res1,Ctx2,ResFull>) {
    this.parent.add(this.middleware)
  }

  end(endpoint: Middleware<Ctx2,Res2,any,ResFull>) {
    this.parent.add(async r => {
      var result = await this.middleware(r)
      if (result instanceof MatchFail) {
        return result
      }
      else {
        return endpoint(result)
      }
    })
    return this.parent
  }
}
