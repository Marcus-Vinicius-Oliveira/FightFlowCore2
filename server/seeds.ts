import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { planos } from "@shared/schema";
import type { InsertPlano } from "@shared/schema";

// Configure WebSocket (same as main app)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

const initialPlanos: InsertPlano[] = [
  {
    nome: "Beta Gratuito",
    limiteAlunos: 10,
    precoMensal: 0, // Free plan
    ativo: true
  },
  {
    nome: "Básico",
    limiteAlunos: 50,
    precoMensal: 4900, // R$ 49,00 in cents
    ativo: true
  },
  {
    nome: "Profissional",
    limiteAlunos: 200,
    precoMensal: 9900, // R$ 99,00 in cents
    ativo: true
  },
  {
    nome: "Enterprise",
    limiteAlunos: 500,
    precoMensal: 19900, // R$ 199,00 in cents
    ativo: true
  }
];

async function seedPlanos() {
  try {
    console.log("🌱 Iniciando seeding dos planos...");
    
    // Check if plans already exist
    const existingPlanos = await db.select().from(planos);
    
    if (existingPlanos.length > 0) {
      console.log(`⚠️  ${existingPlanos.length} planos já existem no banco. Pulando seeding.`);
      return;
    }
    
    // Insert initial plans
    const insertedPlanos = await db.insert(planos).values(initialPlanos).returning();
    
    console.log("✅ Planos criados com sucesso:");
    insertedPlanos.forEach(plano => {
      const preco = plano.precoMensal === 0 ? "Gratuito" : `R$ ${(plano.precoMensal / 100).toFixed(2)}`;
      console.log(`   • ${plano.nome}: ${plano.limiteAlunos} alunos - ${preco}/mês`);
    });
    
  } catch (error) {
    console.error("❌ Erro ao fazer seeding dos planos:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlanos()
    .then(() => {
      console.log("🎉 Seeding concluído com sucesso!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding falhou:", error);
      process.exit(1);
    });
}

export { seedPlanos };