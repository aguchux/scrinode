import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnthropicProvider, FakeProvider, OpenAIProvider, type AIProvider } from '@scrinode/ai';
import { ReaderGuard } from '../common/reader.guard';
import { RetrievalRepository } from '../database/retrieval.repository';
import { SessionRepository } from '../database/session.repository';
import { ZedekRepository } from '../database/zedek.repository';
import { AI_PROVIDER } from './zedek.constants';
import { ZedekController } from './zedek.controller';
import { ZedekService } from './zedek.service';

/**
 * Zedek — §3.3's domain, §16's orchestration.
 *
 * The provider is chosen from configuration, not imported by consumers (§17).
 * Which vendor serves a deployment is an operational decision; nothing in the
 * service or controller knows which one answered.
 */
@Module({
  imports: [ConfigModule],
  controllers: [ZedekController],
  providers: [
    ZedekService,
    ZedekRepository,
    RetrievalRepository,
    SessionRepository,
    ReaderGuard,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AIProvider => {
        const anthropic = config.get<string>('ANTHROPIC_API_KEY');
        const openai = config.get<string>('OPENAI_API_KEY');
        const logger = new Logger('ZedekProvider');

        if (anthropic) return new AnthropicProvider({ apiKey: anthropic });
        if (openai) return new OpenAIProvider({ apiKey: openai });

        // No key configured. A FakeProvider rather than a boot failure, because
        // the rest of the API must still start: a missing Zedek key should not
        // take down the reader.
        //
        // It is loud about it. A provider that silently returned plausible text
        // would be worse than one that fails — a reader cannot tell fabricated
        // prose from a grounded answer, which is the whole concern of §2.2.
        logger.warn(
          'No ANTHROPIC_API_KEY or OPENAI_API_KEY configured. Zedek will return a ' +
            'placeholder rather than a grounded answer. Set a key before serving readers.',
        );

        return new FakeProvider(
          'Zedek is not configured with an AI provider, so this is not a real answer. ' +
            'No Scripture has been consulted and nothing here should be trusted.',
        );
      },
    },
  ],
  exports: [ZedekService],
})
export class ZedekModule {}
