/**
 * Setup del wiring SNS para rebotes/quejas de SES.
 * Corre: node --import tsx --env-file=.env scripts/setup-sns.ts
 *
 * Hace (idempotente):
 *  1. Crea (o reusa) el topic SNS areben-mailer-ses-events
 *  2. Le pone policy para que SES pueda publicar en el topic
 *  3. Suscribe el endpoint HTTPS de la app (se auto-confirma en la ruta)
 *  4. Crea (o reusa) el Configuration Set areben-mailer
 *  5. Crea el event destination (Bounce/Complaint -> topic)
 *
 * Requiere que el user IAM tenga permiso de SNS (setup only).
 * Región us-east-1, cuenta 986232521997.
 */
import {
  SNSClient,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
} from "@aws-sdk/client-sns";
import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
} from "@aws-sdk/client-sesv2";

const REGION = process.env.AWS_REGION || "us-east-1";
const TOPIC_NAME = "areben-mailer-ses-events";
const CONFIG_SET = "areben-mailer";
const ENDPOINT = "https://areben-mailer.vercel.app/api/ses/sns";
const ACCOUNT_ID = "986232521997";

const sns = new SNSClient({ region: REGION });
const ses = new SESv2Client({ region: REGION });

function isAlreadyExists(err: unknown): boolean {
  const name = (err as { name?: string })?.name || "";
  return (
    name === "AlreadyExistsException" ||
    name === "ConfigurationSetAlreadyExistsException" ||
    name === "EventDestinationAlreadyExistsException"
  );
}

async function main() {
  // 1) Topic (CreateTopic es idempotente: si ya existe, devuelve el ARN)
  const { TopicArn } = await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }));
  if (!TopicArn) throw new Error("No se pudo crear/obtener el topic");
  console.log("✅ Topic:", TopicArn);

  // 2) Policy: permitir que el servicio SES publique en este topic
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowSESPublish",
        Effect: "Allow",
        Principal: { Service: "ses.amazonaws.com" },
        Action: "sns:Publish",
        Resource: TopicArn,
        Condition: {
          StringEquals: { "AWS:SourceAccount": ACCOUNT_ID },
        },
      },
    ],
  };
  await sns.send(
    new SetTopicAttributesCommand({
      TopicArn,
      AttributeName: "Policy",
      AttributeValue: JSON.stringify(policy),
    })
  );
  console.log("✅ Policy del topic seteada (SES puede publicar)");

  // 3) Suscripción HTTPS (solo si no existe ya una para este endpoint)
  const subs = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn }));
  const yaSuscripto = (subs.Subscriptions ?? []).some(
    (s) => s.Endpoint === ENDPOINT && s.Protocol === "https"
  );
  if (yaSuscripto) {
    console.log("ℹ️  Suscripción HTTPS ya existente para", ENDPOINT);
  } else {
    await sns.send(
      new SubscribeCommand({ TopicArn, Protocol: "https", Endpoint: ENDPOINT })
    );
    console.log("✅ Suscripción HTTPS creada (la ruta la auto-confirma):", ENDPOINT);
  }

  // 4) Configuration Set
  try {
    await ses.send(
      new CreateConfigurationSetCommand({ ConfigurationSetName: CONFIG_SET })
    );
    console.log("✅ Configuration Set creado:", CONFIG_SET);
  } catch (err) {
    if (isAlreadyExists(err)) console.log("ℹ️  Configuration Set ya existía:", CONFIG_SET);
    else throw err;
  }

  // 5) Event destination (Bounce/Complaint -> topic)
  try {
    await ses.send(
      new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: CONFIG_SET,
        EventDestinationName: "sns-bounces-complaints",
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: ["BOUNCE", "COMPLAINT"],
          SnsDestination: { TopicArn },
        },
      })
    );
    console.log("✅ Event destination creado (Bounce/Complaint -> SNS)");
  } catch (err) {
    if (isAlreadyExists(err)) console.log("ℹ️  Event destination ya existía");
    else throw err;
  }

  console.log("\n=== LISTO ===");
  console.log("SES_CONFIGURATION_SET=" + CONFIG_SET);
  console.log("SES_SNS_TOPIC_ARN=" + TopicArn);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
