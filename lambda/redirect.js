function handler(event) {
  const newUrl = 'https://aws.amazon.com/jp/'
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: newUrl } },
  }
}
