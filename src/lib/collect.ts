import Stream from 'stream'

export default function collect (
  stream: Stream,
  encoding: null | string
) : Promise<string>
{
  return new Promise((resolve, reject) => {
    var body: any[] = []
    stream.on('data', chunk => body.push(chunk))
    stream.on('error', e => reject(e))
    stream.on('end', () => {
      resolve(Buffer.concat(body).toString(encoding || 'utf8'))
    })
  })
}
