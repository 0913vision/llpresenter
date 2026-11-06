import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {expect, onTestFinished} from 'vitest';

export async function startMockLlm(
  handler: (request: IncomingMessage, response: ServerResponse) => unknown,
) {
  const failures: unknown[] = [];
  const server = createServer((request, response) => {
    Promise.resolve()
      .then(() => handler(request, response))
      .catch((error: unknown) => {
        failures.push(error);
        response.statusCode = 500;
        response.end();
      });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing mock port');
  }
  onTestFinished(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
    expect(failures).toEqual([]);
  });
  return {port: address.port, endpoint: `http://127.0.0.1:${address.port}`};
}

export async function readMockLlmBody(
  request: IncomingMessage,
): Promise<unknown> {
  request.setEncoding('utf8');
  let text = '';
  for await (const chunk of request) text += String(chunk);
  return JSON.parse(text);
}
