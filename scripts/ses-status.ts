import { SESv2Client, GetAccountCommand } from '@aws-sdk/client-sesv2'
async function main() {
  const c = new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1', credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! } })
  const r = await c.send(new GetAccountCommand({}))
  console.log(JSON.stringify({ ProductionAccessEnabled: r.ProductionAccessEnabled, SendingEnabled: r.SendingEnabled, Max24Hour: r.SendQuota?.Max24HourSend, MaxSendRate: r.SendQuota?.MaxSendRate, Sent24h: r.SendQuota?.SentLast24Hours, Review: r.Details?.ReviewDetails }, null, 2))
}
main()
