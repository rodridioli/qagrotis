
import dotenv from "dotenv"
import path from "path"

// Carregar variáveis de ambiente ANTES de qualquer outro import
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { sendMail } from "../lib/mail"

async function runTest() {
  console.log("--- INICIANDO TESTE DE EMAIL ---")
  console.log("Variável RESEND_API_KEY presente?:", !!process.env.RESEND_API_KEY)
  if (process.env.RESEND_API_KEY) {
    console.log("Início da chave:", process.env.RESEND_API_KEY.substring(0, 6) + "...")
  }
  console.log("Remetente configurado:", process.env.EMAIL_FROM || "noreply@qagrotis.com.br")
  
  const testEmail = "rodridioli@gmail.com" // Email de cadastro do Rodrigo
  
  const result = await sendMail({
    to: testEmail,
    subject: "Teste de Integração - QAgrotis",
    html: `
      <h1>Teste de Sistema</h1>
      <p>Este é um e-mail de teste para validar a nova arquitetura híbrida (Resend + SMTP).</p>
      <p>Data/Hora: ${new Date().toLocaleString()}</p>
    `
  })

  if (result.success) {
    console.log("\n✅ SUCESSO: O sistema conseguiu processar o envio.")
  } else {
    console.error("\n❌ FALHA:", result.error)
    console.log("\n💡 Dica: Verifique se a RESEND_API_KEY ou as variáveis SMTP estão configuradas no seu .env")
  }
}

runTest()
