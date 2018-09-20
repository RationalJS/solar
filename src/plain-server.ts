import Router from './router'
import * as Route from './route'

type ServerResponse = {
  status: number
  headers: Route.HttpHeaders
  body: Route.Body
}

export function create (router: Router<any,any>) {
  return {
    async request(
      method: string,
      url: string,
      headers: Route.HttpHeaders = {},
      body?: string
    ): Promise<ServerResponse>
    {
      var req = Route.makeReq(method.toUpperCase(), url, body || null, headers)

      var respond = (status:number, headers:Route.HttpHeaders, body:Route.Body) =>
        ({ status, headers, body })

      for (var route of router._routes) {

        try {
          var result = await route(req)
        } catch (e) {
          if (e instanceof Route.BodyParseError) {
            return respond(400, {}, { message: 'body_parse_error' })
          }
          else {
            return respond(400, {}, { message: 'unexpected_error' })
          }
        }

        if (result instanceof Route.MatchFail) {
          continue
        }
        var res = result.res

        return respond(res.status, res.headers, res.body)
      }

      return respond(404, {}, { message: 'no_such_route' })
    }
  }
}
