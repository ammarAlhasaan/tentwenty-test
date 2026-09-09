import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpExceptionFilter } from './http-exception.filter.js';

const PATH = '/example';

function setup() {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { reply, getRequestUrl: () => PATH },
  } as unknown as HttpAdapterHost;

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  return { filter: new HttpExceptionFilter(adapterHost), host, reply, logged };
}

function bodyOf(reply: ReturnType<typeof vi.fn>) {
  return reply.mock.calls[0][1];
}

beforeEach(() => vi.restoreAllMocks());

describe('HttpExceptionFilter', () => {
  it('maps a validation failure to 400 in the standard shape', () => {
    const { filter, host, reply } = setup();
    filter.catch(new BadRequestException(['email: Invalid email address']), host);

    expect(reply.mock.calls[0][2]).toBe(400);
    expect(bodyOf(reply)).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: ['email: Invalid email address'],
      path: PATH,
    });
  });

  it('preserves the status of a known error', () => {
    const { filter, host, reply } = setup();
    filter.catch(new NotFoundException('Project not found'), host);

    expect(reply.mock.calls[0][2]).toBe(404);
    expect(bodyOf(reply)).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: ['Project not found'],
    });
  });

  it('turns an unexpected error into a generic 500 that leaks nothing', () => {
    const { filter, host, reply } = setup();
    const secret = 'connection failed for /Users/someone/secret/margin.sqlite';
    filter.catch(new Error(secret), host);

    const body = bodyOf(reply);
    expect(reply.mock.calls[0][2]).toBe(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: ['Internal server error'],
    });

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(secret);
    expect(serialised).not.toContain('/Users/');
    expect(serialised).not.toContain('.sqlite');
    expect(serialised).not.toContain('at ');
  });

  it('logs an unexpected error once, with its stack', () => {
    const { filter, host, logged } = setup();
    const error = new Error('boom');

    filter.catch(error, host);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][1]).toBe(error.stack);
  });

  it('does not log expected errors at error level', () => {
    const { filter, host, logged } = setup();

    filter.catch(new NotFoundException('nope'), host);
    filter.catch(new BadRequestException(['bad']), host);

    expect(logged).not.toHaveBeenCalled();
  });

  it('returns an identical field set for all three error classes', () => {
    const keysFor = (exception: unknown) => {
      const { filter, host, reply } = setup();
      filter.catch(exception, host);
      return Object.keys(bodyOf(reply)).sort();
    };

    const expected = ['error', 'message', 'path', 'statusCode', 'timestamp'];
    expect(keysFor(new BadRequestException(['bad']))).toEqual(expected);
    expect(keysFor(new NotFoundException('nope'))).toEqual(expected);
    expect(keysFor(new Error('boom'))).toEqual(expected);
  });

  it('always exposes message as an array, even for a single string', () => {
    const { filter, host, reply } = setup();
    filter.catch(new NotFoundException('single'), host);
    expect(Array.isArray(bodyOf(reply).message)).toBe(true);
  });

  it('formats the exception the validation pipe raises, one entry per failed field', async () => {
    const schema = z.object({ month: z.number(), year: z.number() });
    const pipe = new StandardSchemaValidationPipe();

    const thrown = await pipe
      .transform({ month: 'x' }, { type: 'body', schema } as never)
      .then(() => undefined)
      .catch((error: unknown) => error);

    const { filter, host, reply } = setup();
    filter.catch(thrown, host);

    expect(reply.mock.calls[0][2]).toBe(400);
    const { message } = bodyOf(reply);
    expect(message).toHaveLength(2);
    expect(message.join('\n')).toContain('month');
    expect(message.join('\n')).toContain('year');
  });
});
