function handler(event) {
  const uri = event.request.uri
  if (isNotRedirect(uri)) return event.request

  const newUri = getNewUri(uri)
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: newUri } },
  }
}

function isNotRedirect(uri) {
  return uri === '/' || uri === '/index.html'
}

function getNewUri(uri) {
  if (uri === '/page1.html') {
    return 'https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html'
  }
  return 'https://aws.amazon.com/jp/'
}
