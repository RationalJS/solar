import Stream from 'stream'
import http from 'http'
import Router from './router'
import * as Route from './route'

var statusCodes: Record<number,string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Moved Temporarily',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Time-out',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Large',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  418: 'I\'m a teapot',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Unordered Collection',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Time-out',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended',
  511: 'Network Authentication Required',
}

function fromRequest (req: http.IncomingMessage): Route.Req {
  return Route.makeReq(
    (req.method || 'GET').toUpperCase(),
    req.url || '/',
    req,
    req.headers as Record<string,string>
  )
}

export function createServer (router: Router) {
  var server = http.createServer(async (request, response) => {
    var respondStatus = (status: number, headers: any, message: any) => {
      headers['content-type'] = 'application/json'
      response.writeHead(status, headers)

      response.write(JSON.stringify({
        statusCode: status,
        error: statusCodes[status],
        message: message
      }))
      response.end()
    }

    var req = fromRequest(request)
    for (var route of router._routes) {

      try {
        var result = await route(req)
      } catch (e) {
        if (e instanceof Route.BodyParseError) {
          response.writeHead(400)
          respondStatus(400, {}, 'body_parse_error')
        }
        else {
          response.writeHead(500)
          respondStatus(500, {}, 'unexpected_error')
        }
        return
      }

      if (result instanceof Route.MatchFail) {
        continue
      }
      var res = result.res
      // console.log("OUTPUT BODY", res.body!.constructor)

      if (res.body instanceof Stream) {
        response.writeHead(res.status, res.headers)
        res.body.pipe(response)
      }
      else if (res.status >= 300 && statusCodes[res.status]) {
        respondStatus(res.status, res.headers, res.body || undefined)
      }
      else {
        response.writeHead(res.status, res.headers)
        response.write(res.body)
        response.end()
      }
      return
    }
    response.writeHead(404, {})
    response.write('{404:"not_found"}')
    response.end()
  })
  return server
}
