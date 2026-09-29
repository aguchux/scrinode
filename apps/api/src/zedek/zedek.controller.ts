import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ZedekStreamEvent } from '@scrinode/types';
import type { Response } from 'express';
import { ReaderGuard, readerIdOf, type AuthenticatedRequest } from '../common/reader.guard';
import { ZedekService } from './zedek.service';

/**
 * Zedek's HTTP surface — §40's endpoint shape, §18's transport.
 *
 * SSE rather than one JSON response: §31 targets a first chunk within 2s, and a
 * complete answer takes considerably longer.
 *
 * Every route is guarded. `userId` comes from the session, never from the
 * request body — accepting it from a caller would let anyone read any reader's
 * research, which is the ownership rule §33 exists to enforce.
 */
@UseGuards(ReaderGuard)
@Controller('zedek')
export class ZedekController implements OnApplicationShutdown {
  /** In-flight streams, aborted on shutdown so a deploy does not hang. */
  private readonly inFlight = new Set<AbortController>();

  constructor(private readonly zedek: ZedekService) {}

  /**
   * Which translations this reader may be served.
   *
   * §22.1 makes `isAvailable()` the gate, and `@scrinode/scripture` owns the
   * registry. Hard-coded to the ten loaded, public-domain translations until the
   * scripture module is wired: widening this by guessing would risk serving text
   * whose licence has not been verified, which §22.1 treats as a breach rather
   * than a bug.
   */
  private static readonly AVAILABLE_TRANSLATIONS = [
    'ASV',
    'BBE',
    'BSB',
    'DBY',
    'DRA',
    'GNV',
    'KJV',
    'WBT',
    'WEB',
    'YLT',
  ] as const;

  /**
   * Ask a question in a conversation.
   *
   * Rate limited well below the API default: every call may spend money with a
   * vendor, so this is a cost control as much as an abuse one. §30 notes the
   * real limit is enforced by Vercel WAF at the edge, because in-process
   * counters are per-instance on functions — this is the backstop that does work
   * in a container.
   */
  @Throttle({ short: { limit: 3, ttl: 10_000 }, sustained: { limit: 30, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  async ask(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() body: { content?: unknown },
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (content.length === 0) throw new BadRequestException('A question is required.');

    // A cap on the question, because it becomes input tokens. Generous enough
    // for a pasted passage plus a question.
    if (content.length > 4_000) throw new BadRequestException('That question is too long.');

    const controller = new AbortController();
    this.inFlight.add(controller);

    try {
      await this.pipe(
        this.zedek.ask(
          {
            conversationId,
            userId: readerIdOf(request),
            question: content,
            translations: ZedekController.AVAILABLE_TRANSLATIONS,
          },
          controller.signal,
        ),
        response,
        controller,
      );
    } finally {
      this.inFlight.delete(controller);
    }
  }

  /** A conversation's messages with their citations. */
  @Get('conversations/:id/messages')
  async messages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.zedek.history(conversationId, readerIdOf(request));
  }

  /**
   * Write §18's events to an SSE stream.
   *
   * Kept out of the service so the transport's failure modes — a client
   * disconnecting, a half-written frame — stay away from the orchestration.
   */
  private async pipe(
    events: AsyncGenerator<ZedekStreamEvent>,
    response: Response,
    controller: AbortController,
  ): Promise<void> {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Without this a proxy may buffer the whole response and deliver it at
      // once, which is indistinguishable from a slow model.
      'X-Accel-Buffering': 'no',
    });

    // A reader who navigates away leaves the generator running and the model
    // billing. §18 requires cancellation; this triggers it.
    response.on('close', () => controller.abort());

    try {
      for await (const event of events) {
        if (controller.signal.aborted) break;
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      // Headers are already sent, so an exception filter cannot help. A generic
      // message: §33 keeps infrastructure detail off the wire, and a vendor
      // error body can echo the prompt.
      const error: ZedekStreamEvent = {
        type: 'error',
        message: 'Zedek could not complete this response.',
      };

      response.write(`data: ${JSON.stringify(error)}\n\n`);
    } finally {
      response.end();
    }
  }

  /**
   * Abort in-flight streams on shutdown.
   *
   * A container receives SIGTERM and waits for open requests; an SSE stream can
   * outlive that window, so a deploy would hang until it timed out.
   */
  onApplicationShutdown(): void {
    for (const controller of this.inFlight) controller.abort();
    this.inFlight.clear();
  }
}
