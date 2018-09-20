import {Stream} from 'stream'
import collect from './lib/collect'

export type HttpHeaders = Record<string,string>

export type Req = {
  readonly headers: HttpHeaders,
  readonly method: string,
  readonly url: string
  readonly urlMatched: string
  _body:
      { loaded: 'false' /* ts quirk */, value: null | string | Stream | object }
    | { loaded: 'true' /* ts quirk */, value: null | string | object }
}

export type Body = null | string | Stream | object

export type ResFresh = { type: 'fresh', headers: HttpHeaders }
export type ResWithStatus = { type: 'with-status', headers: HttpHeaders, status: number }
export type ResFull = { type: 'ended', headers: HttpHeaders, status: number, body: Body }
type Res = ResFresh | ResWithStatus | ResFull


type RouteStruct<Ctx,ResType> = {
  readonly req: Req
  readonly res: ResType
  readonly ctx: Ctx
  readonly urlMatched: number
}

type BodyParseOptions = {
  encoding?: string,
  limit?: string
}

export class MatchFail {}
export class BodyParseError extends Error {}


class Route<Ctx,ResType> {
  private _struct: RouteStruct<Ctx,ResType>

  constructor(struct: RouteStruct<Ctx,ResType>) {
    this._struct = struct
  }

  get req() { return this._struct.req }
  get res() { return this._struct.res }
  get ctx() { return this._struct.ctx }

  extend<Ctx1 extends {},Ctx2,R1>(this: Route<Ctx1,R1>, attrs: Ctx2): Route<Ctx1 & Ctx2,R1> {
    return new Route({
      ...this._struct,
      ctx: ({ ...(this._struct.ctx as any), ...(attrs as any) } as Ctx1 & Ctx2),
    })
  }

  setContext<Ctx2>(this: Route<Ctx,ResType>, ctx: Ctx2): Route<Ctx2,ResType> {
    return new Route({ ...this._struct, ctx: ctx })
  }

  // match(paths: RegExp[]): Route<Ctx,ResType> | MatchFail;
  // match<T>(paths: RegExp[], parser: (param: string) => T): Route<Ctx&T,ResType> | MatchFail;
  // match<T>(paths: RegExp[], parser?: (param: string) => T) {
  //   var left = this.req.urlMatched.slice(this._struct.urlMatched)
  //   console.log(this.req.url, '-', this._struct.urlMatched, '=', left)
  //   if (! left.length || paths.length > left.length) {
  //     return this.fail()
  //   }

  //   var matches = paths.map((p,i) => left[i].match(p))
  //   if (! matches.every(m => !! m)) return this.fail()

  //   var partsMatched = this._struct.urlMatched + paths.length

  //   if (parser) {
  //     var r2 = this.extend( parser(matches[matches.length]![0]) )
  //     r2._struct = { ...r2._struct, urlMatched: partsMatched }
  //     return r2
  //   }
  //   else {
  //     return new Route({ ...this._struct, urlMatched: partsMatched })
  //   }
  // }

  body<JsonBodyType=any>(type: 'json', options?: BodyParseOptions): Promise<JsonBodyType>;
  body(type: 'text', options?: BodyParseOptions): Promise<null | string>;
  body(type: 'text' | 'json', options: BodyParseOptions = {})
  {
    const {value} = this.req._body
    if (this.req._body.loaded === 'true') { // ts quirk
      return Promise.resolve(this.req._body.value)
    }
    else if (value instanceof Stream) {
      return collect(value, options.encoding || 'utf8').then(payload => {
        this.req._body = { loaded: 'true', value: payload }

        if (type === 'json') {
          try {
            return JSON.parse(payload)
          } catch (e) {
            if (e instanceof SyntaxError) {
              throw new BodyParseError()
            } else {
              throw e
            }
          }
        }
        else {
          this.req._body = { loaded: 'true', value: payload }
          return payload
        }
      })
    }
    else {
      return Promise.resolve(value)
    }
  }

  header(this: Route<Ctx,Res>, key: string): string;
  header<R1 extends Res>(this: Route<Ctx,R1>, key: string, value: string): Route<Ctx,ResType>;
  header<R1 extends Res>(this: Route<Ctx,R1>, key: string, value?: string) {
    if (value) {
      var res = this._struct.res
      return new Route({
        ...this._struct,
        res: {
          ...(res as any), // ts quirk
          headers: {...res.headers, [key]: value}
        }
      })
    }
    else {
      return this._struct.res.headers[key]
    }
  }

  status(this: Route<Ctx,ResFresh>, status: number): Route<Ctx,ResWithStatus> {
    var r = this._struct
    var newRes: ResWithStatus = {
      type: 'with-status',
      status: status,
      headers: r.res.headers,
    }
    return new Route({ ...r, res: newRes })
  }

  send<Ctx>(this: Route<Ctx,ResFresh|ResWithStatus>, body: Body): Route<Ctx,ResFull> {
    var isJsonObj = isObj(body) && ! (body instanceof Stream)

    var r = this._struct
    var newRes: ResFull = {
      type: 'ended',
      status: r.res.type === 'fresh' ? 200 : r.res.status,
      headers: r.res.headers,
      body: isJsonObj ? JSON.stringify(body) : body,
    }

    if (typeof body === 'string') {
      newRes.headers = { ...newRes.headers, 'content-type': 'text/plain' }
    }
    else if (isJsonObj) {
      newRes.headers = { ...newRes.headers, 'content-type': 'application/json' }
    }

    return new Route({ ...r, res: newRes })
  }

  fail(): MatchFail {
    return new MatchFail()
  }
}

export type Middleware<C1,R1,C2,R2> = (r: Route<C1,R1>) => Promise<Route<C2,R2> | MatchFail>

export type Fresh = Route<{},ResFresh>
export type Handler = Middleware<{},ResFresh,any,ResFull>

export type t = ReturnType<typeof make>

export function make (handler: Handler) {
  return (req: Req) => {
    var res: ResFresh = { type: 'fresh', headers: {} }
    var fresh = new Route({
      ctx: {},
      req: req,
      res: res,
      urlMatched: 0
    })

    return handler(fresh)
  }
}

export function makeReq (method: string, url: string, body: Body, headers: Record<string,string>): Req {
  return {
    headers: (headers as Record<string,string>) || {},
    method: method || 'GET',
    url: url,
    urlMatched: '',
    _body: { loaded: 'false', value: body },
  }
}

function isObj (subject: unknown): subject is object {
  return Object.prototype.toString.call(subject) === "[object Object]"
}
