import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL!],
      queue: "game_events_queue",
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  const config = new DocumentBuilder()
    .setTitle("Games Service")
    .setDescription(
      "Crash Game — round lifecycle, bets, cash outs and provably fair verification.\n\n" +
      "**WebSocket events** (emitted by server via Socket.io at `/games/socket.io`):\n" +
      "- `round:new` — new BETTING phase started\n" +
      "- `round:started` — multiplier is now rising\n" +
      "- `round:tick` — current multiplier update (every ~100 ms)\n" +
      "- `round:crashed` — round ended, crash point revealed\n" +
      "- `bet:placed` — a player placed a bet\n" +
      "- `bet:confirmed` — wallet debit confirmed, bet is ACTIVE\n" +
      "- `bet:cancelled` — wallet debit failed, bet cancelled\n" +
      "- `bet:cashout` — a player cashed out",
    )
    .setVersion("1.0")
    .addServer("http://localhost:8000/games", "Kong API Gateway")
    .addServer("http://localhost:4001", "Direct")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: { url: "docs-json" },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT!, "0.0.0.0");
  console.log(`Games service running on port ${process.env.PORT}`);
  console.log(`Swagger docs available at http://localhost:${process.env.PORT}/docs`);
}

bootstrap();
