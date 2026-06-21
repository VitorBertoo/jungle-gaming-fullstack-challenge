import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL!],
      queue: "wallet_events_queue",
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  const config = new DocumentBuilder()
    .setTitle("Wallets Service")
    .setDescription(
      "Crash Game — player wallet management.\n\n" +
      "Credit and debit operations are **not** exposed via REST — they are triggered " +
      "asynchronously by the Games Service through RabbitMQ as part of the bet saga.",
    )
    .setVersion("1.0")
    .addServer("http://localhost:8000/wallets", "Kong API Gateway")
    .addServer("http://localhost:4002", "Direct")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", in: "header", name: "x-admin-key" }, "x-admin-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: { url: "docs-json" },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT!, "0.0.0.0");
  console.log(`Wallets service running on port ${process.env.PORT}`);
  console.log(`Swagger docs available at http://localhost:${process.env.PORT}/docs`);
}

bootstrap();
